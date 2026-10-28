//! A clicked update downloads and verifies setup before handing installation to
//! a separate cached copy of this executable. That copy waits on a real parent
//! process handle, so neither a tray-hidden app nor a reused PID races setup.
use crate::updates::{latest_installer, InstallerPlan, MAX_INSTALLER_BYTES};
use reqwest::{redirect::Policy, Client, StatusCode};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::atomic::{AtomicBool, AtomicU64, Ordering},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};

const HELPER_FLAG: &str = "--dino-update-handoff";
const HELPER_NAME: &str = "DinoLabUpdateHelper.exe";
const INSTALLER_NAME: &str = "setup.exe";
const MANIFEST_NAME: &str = "update.json";
const READY_NAME: &str = "ready";
static INSTALLING: AtomicBool = AtomicBool::new(false);
static JOB_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct InstallProgress {
    phase: &'static str,
    downloaded_bytes: u64,
    total_bytes: u64,
}

fn progress(app: &AppHandle, phase: &'static str, downloaded_bytes: u64, total_bytes: u64) {
    let _ = app.emit(
        "update-install-progress",
        InstallProgress {
            phase,
            downloaded_bytes,
            total_bytes,
        },
    );
}

struct InstallGuard(bool);
impl InstallGuard {
    fn acquire() -> Result<Self, String> {
        INSTALLING
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map(|_| Self(true))
            .map_err(|_| "An update is already being prepared.".into())
    }
}
impl Drop for InstallGuard {
    fn drop(&mut self) {
        if self.0 {
            INSTALLING.store(false, Ordering::Release);
        }
    }
}

fn safe_download_redirect(url: &url::Url) -> bool {
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some_and(|port| port != 443)
        || url.fragment().is_some()
    {
        return false;
    }
    match url.host_str() {
        Some("release-assets.githubusercontent.com" | "objects.githubusercontent.com") => true,
        Some("github.com") => {
            let Ok(config) =
                serde_json::from_str::<serde_json::Value>(include_str!("../update-config.json"))
            else {
                return false;
            };
            let owner = config["owner"].as_str().unwrap_or_default();
            let repo = config["repo"].as_str().unwrap_or_default();
            url.path()
                .to_ascii_lowercase()
                .starts_with(&format!("/{owner}/{repo}/releases/download/").to_ascii_lowercase())
                && url.query().is_none()
        }
        _ => false,
    }
}

fn download_client() -> Result<Client, String> {
    Client::builder()
        .https_only(true)
        .referer(false)
        .user_agent(concat!("Dino-Lab/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(300))
        .redirect(Policy::custom(|attempt| {
            if attempt.previous().len() >= 5 {
                attempt.error("Too many installer redirects")
            } else if safe_download_redirect(attempt.url()) {
                attempt.follow()
            } else {
                attempt.error("Installer redirected outside trusted GitHub downloads")
            }
        }))
        .build()
        .map_err(|_| "The installer download could not start.".into())
}

fn job_directory(cache: &Path) -> Result<PathBuf, String> {
    let root = cache.join("updates");
    fs::create_dir_all(&root).map_err(|_| "The update download folder could not be created.")?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    for _ in 0..10 {
        let sequence = JOB_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let job = root.join(format!(
            "dino-lab-update-{}-{timestamp}-{sequence}",
            std::process::id()
        ));
        match fs::create_dir(&job) {
            Ok(()) => return Ok(job),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(_) => return Err("The update download folder could not be created.".into()),
        }
    }
    Err("A unique update download folder could not be created.".into())
}

fn checked_download_size(received: u64, added: usize, expected: u64) -> Result<u64, String> {
    let size = received
        .checked_add(added as u64)
        .ok_or("The installer is unexpectedly large.")?;
    if size > expected || size > MAX_INSTALLER_BYTES {
        return Err("The installer size does not match the published release.".into());
    }
    Ok(size)
}

async fn download(app: &AppHandle, plan: &InstallerPlan, job: &Path) -> Result<PathBuf, String> {
    let partial = job.join("setup.partial");
    let mut response = download_client()?
        .get(&plan.url)
        .send()
        .await
        .map_err(|_| {
            "The installer could not be downloaded. Check your connection and try again."
        })?;
    if response.status() != StatusCode::OK {
        return Err("GitHub could not provide the installer. Please try again later.".into());
    }
    if response
        .content_length()
        .is_some_and(|size| size != plan.size)
    {
        return Err("The installer size does not match the published release.".into());
    }
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&partial)
        .map_err(|_| "The installer download could not be saved.")?;
    let mut received = 0;
    let result: Result<(), String> = async {
        let mut last_progress = Instant::now();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| "The installer download was interrupted. Please try again.")?
        {
            received = checked_download_size(received, chunk.len(), plan.size)?;
            file.write_all(&chunk)
                .map_err(|_| "The installer download could not be saved.")?;
            if last_progress.elapsed() >= Duration::from_millis(100) || received == plan.size {
                progress(app, "downloading", received, plan.size);
                last_progress = Instant::now();
            }
        }
        file.sync_all()
            .map_err(|_| "The installer download could not be saved.")?;
        if received != plan.size {
            return Err("The installer download was incomplete. Please try again.".into());
        }
        Ok(())
    }
    .await;
    drop(file);
    if let Err(error) = result {
        let _ = fs::remove_file(&partial);
        return Err(error);
    }
    progress(app, "verifying", received, plan.size);
    if let Err(error) = verify_installer(&partial, plan.size, &plan.sha256) {
        let _ = fs::remove_file(&partial);
        return Err(error);
    }
    let installer = job.join(INSTALLER_NAME);
    fs::rename(&partial, &installer)
        .map_err(|_| "The verified installer could not be prepared.")?;
    Ok(installer)
}

fn file_sha256(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|_| "The downloaded installer could not be opened.")?;
    let mut hash = Sha256::new();
    let mut buffer = [0; 64 * 1024];
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|_| "The downloaded installer could not be read.")?;
        if count == 0 {
            break;
        }
        hash.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hash.finalize()))
}

fn verify_installer_file(
    file: &mut File,
    expected_size: u64,
    expected_sha: &str,
) -> Result<(), String> {
    let metadata = file
        .metadata()
        .map_err(|_| "The downloaded installer is unavailable.")?;
    if !metadata.file_type().is_file()
        || metadata.len() != expected_size
        || expected_size < 64
        || expected_size > MAX_INSTALLER_BYTES
    {
        return Err("The installer size does not match the published release.".into());
    }
    file.seek(SeekFrom::Start(0))
        .map_err(|_| "The downloaded installer could not be read.")?;
    let mut hash = Sha256::new();
    let mut buffer = [0; 64 * 1024];
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|_| "The downloaded installer could not be read.")?;
        if count == 0 {
            break;
        }
        hash.update(&buffer[..count]);
    }
    if format!("{:x}", hash.finalize()) != expected_sha {
        return Err(
            "The installer verification failed. Nothing was installed; please try again.".into(),
        );
    }
    file.seek(SeekFrom::Start(0))
        .map_err(|_| "The downloaded installer could not be read.")?;
    let mut header = [0; 64];
    file.read_exact(&mut header)
        .map_err(|_| "The downloaded installer is not a Windows executable.")?;
    let pe_offset = u32::from_le_bytes(header[60..64].try_into().unwrap()) as u64;
    if &header[..2] != b"MZ" || pe_offset < 64 || pe_offset > expected_size.saturating_sub(4) {
        return Err("The downloaded installer is not a Windows executable.".into());
    }
    file.seek(SeekFrom::Start(pe_offset))
        .map_err(|_| "The downloaded installer is invalid.")?;
    let mut pe = [0; 4];
    file.read_exact(&mut pe)
        .map_err(|_| "The downloaded installer is invalid.")?;
    if &pe != b"PE\0\0" {
        return Err("The downloaded installer is not a Windows executable.".into());
    }
    Ok(())
}

/// This same handle stays alive through ShellExecute in the helper. On Windows
/// FILE_SHARE_READ permits installer reads but denies modification/deletion.
fn open_verified_installer(
    path: &Path,
    expected_size: u64,
    expected_sha: &str,
) -> Result<File, String> {
    if !fs::symlink_metadata(path)
        .map_err(|_| "The downloaded installer is unavailable.")?
        .file_type()
        .is_file()
    {
        return Err("The downloaded installer is not a regular file.".into());
    }
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.share_mode(windows_sys::Win32::Storage::FileSystem::FILE_SHARE_READ);
    }
    let mut file = options
        .open(path)
        .map_err(|_| "The downloaded installer could not be locked for verification.")?;
    verify_installer_file(&mut file, expected_size, expected_sha)?;
    Ok(file)
}

fn verify_installer(path: &Path, expected_size: u64, expected_sha: &str) -> Result<(), String> {
    open_verified_installer(path, expected_size, expected_sha).map(drop)
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Handoff {
    parent_pid: u32,
    version: String,
    size: u64,
    sha256: String,
}

fn write_new(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|_| "The update handoff could not be prepared.")?;
    file.write_all(bytes)
        .and_then(|_| file.sync_all())
        .map_err(|_| "The update handoff could not be saved.".into())
}

fn spawn_helper(job: &Path, plan: &InstallerPlan) -> Result<Child, String> {
    let current =
        std::env::current_exe().map_err(|_| "The running application could not be located.")?;
    let helper = job.join(HELPER_NAME);
    let mut from = File::open(&current).map_err(|_| "The update helper could not be prepared.")?;
    let mut to = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&helper)
        .map_err(|_| "The update helper could not be saved.")?;
    std::io::copy(&mut from, &mut to)
        .and_then(|_| to.sync_all())
        .map_err(|_| "The update helper could not be saved.")?;
    drop(to);
    if file_sha256(&current)? != file_sha256(&helper)? {
        return Err("The update helper could not be verified.".into());
    }
    let manifest = Handoff {
        parent_pid: std::process::id(),
        version: plan.version.clone(),
        size: plan.size,
        sha256: plan.sha256.clone(),
    };
    write_new(
        &job.join(MANIFEST_NAME),
        &serde_json::to_vec(&manifest).map_err(|_| "The update handoff could not be prepared.")?,
    )?;
    let mut command = Command::new(&helper);
    command
        .arg(HELPER_FLAG)
        .current_dir(job)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(windows_sys::Win32::System::Threading::CREATE_NO_WINDOW);
    }
    command
        .spawn()
        .map_err(|_| "The update helper could not start. Dino Lab is still open.".into())
}

fn ready_for_exit(
    marker: Option<&str>,
    helper_pid: u32,
    helper_alive: bool,
) -> Result<bool, String> {
    if !helper_alive {
        return Err("The update helper did not become ready. Dino Lab is still open.".into());
    }
    Ok(marker == Some(helper_pid.to_string().as_str()))
}

fn await_ready(job: &Path, child: &mut Child) -> Result<(), String> {
    let started = Instant::now();
    loop {
        let alive = child
            .try_wait()
            .map_err(|_| "The update helper could not be checked.")?
            .is_none();
        let marker = fs::read_to_string(job.join(READY_NAME)).ok();
        if ready_for_exit(marker.as_deref(), child.id(), alive)? {
            // Check the child again after the ready marker, before committing to exit.
            if child
                .try_wait()
                .map_err(|_| "The update helper could not be checked.")?
                .is_none()
            {
                return Ok(());
            }
        }
        if started.elapsed() >= Duration::from_secs(10) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(
                "The update helper timed out. Dino Lab is still open; please try again.".into(),
            );
        }
        std::thread::sleep(Duration::from_millis(50));
    }
}

#[tauri::command]
pub async fn install_update(expected_version: String, app: AppHandle) -> Result<(), String> {
    let mut guard = InstallGuard::acquire()?;
    let plan = latest_installer(&expected_version).await?;
    let cache = app
        .path()
        .app_cache_dir()
        .map_err(|_| "The update cache folder is unavailable.")?;
    let job = job_directory(&cache)?;
    progress(&app, "downloading", 0, plan.size);
    download(&app, &plan, &job).await?;
    let handoff_job = job.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut child = spawn_helper(&handoff_job, &plan)?;
        await_ready(&handoff_job, &mut child)
    })
    .await
    .map_err(|_| "The update helper could not be prepared.")??;
    guard.0 = false; // Stay locked until process exit; never prepare two installers.
    progress(&app, "launching", 0, 0);
    // Return the successful IPC reply before exiting the process. This bypasses
    // the close-to-tray window handler; the helper already holds our handle.
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(200)).await;
        app.exit(0);
    });
    Ok(())
}

fn helper_job(executable: &Path) -> Result<PathBuf, String> {
    if !executable.is_absolute() {
        return Err("The update helper path is invalid.".into());
    }
    if executable.file_name().and_then(|name| name.to_str()) != Some(HELPER_NAME) {
        return Err("The update helper path is invalid.".into());
    }
    let job = executable
        .parent()
        .ok_or("The update helper folder is invalid.")?;
    let name = job
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or("The update job is invalid.")?;
    let suffix = name
        .strip_prefix("dino-lab-update-")
        .ok_or("The update job is invalid.")?;
    if suffix.is_empty()
        || !suffix.bytes().all(|b| b.is_ascii_digit() || b == b'-')
        || job
            .parent()
            .and_then(Path::file_name)
            .and_then(|name| name.to_str())
            != Some("updates")
    {
        return Err("The update job is invalid.".into());
    }
    Ok(job.to_path_buf())
}

fn validate_handoff(manifest: &Handoff) -> Result<(), String> {
    let version = semver::Version::parse(&manifest.version)
        .map_err(|_| "The installer version is invalid.")?;
    let current = semver::Version::parse(env!("CARGO_PKG_VERSION"))
        .map_err(|_| "The helper version is invalid.")?;
    if !version.pre.is_empty()
        || version.cmp_precedence(&current) != std::cmp::Ordering::Greater
        || manifest.parent_pid == 0
        || manifest.parent_pid == std::process::id()
        || manifest.size < 64
        || manifest.size > MAX_INSTALLER_BYTES
        || manifest.sha256.len() != 64
        || !manifest
            .sha256
            .bytes()
            .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
    {
        return Err("The update handoff metadata is invalid.".into());
    }
    Ok(())
}

#[cfg(windows)]
struct ParentProcess(windows_sys::Win32::Foundation::HANDLE);
#[cfg(windows)]
impl ParentProcess {
    fn open(pid: u32) -> Result<Self, String> {
        use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_SYNCHRONIZE};
        let handle = unsafe { OpenProcess(PROCESS_SYNCHRONIZE, 0, pid) };
        if handle.is_null() {
            return Err("The running application could not be tracked.".into());
        }
        Ok(Self(handle))
    }
    fn wait(&self) -> Result<(), String> {
        use windows_sys::Win32::{
            Foundation::WAIT_OBJECT_0, System::Threading::WaitForSingleObject,
        };
        if unsafe { WaitForSingleObject(self.0, 30_000) } != WAIT_OBJECT_0 {
            return Err("Dino Lab did not finish closing; the installer was not started.".into());
        }
        Ok(())
    }
}
#[cfg(windows)]
impl Drop for ParentProcess {
    fn drop(&mut self) {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(self.0);
        }
    }
}

fn finish_after_parent_exit(
    wait: impl FnOnce() -> Result<(), String>,
    verify: impl FnOnce() -> Result<(), String>,
    launch: impl FnOnce() -> Result<(), String>,
    notify_after_exit: impl FnOnce(&str),
) -> Result<(), String> {
    wait()?;
    let result = verify().and_then(|_| launch());
    if let Err(message) = &result {
        notify_after_exit(message);
    }
    result
}

#[cfg(windows)]
fn run_helper(job: &Path) -> Result<(), String> {
    let bytes = fs::read(job.join(MANIFEST_NAME))
        .map_err(|_| "The update handoff metadata is unavailable.")?;
    if bytes.len() > 4096 {
        return Err("The update handoff metadata is invalid.".into());
    }
    let manifest: Handoff =
        serde_json::from_slice(&bytes).map_err(|_| "The update handoff metadata is invalid.")?;
    validate_handoff(&manifest)?;
    let installer = job.join(INSTALLER_NAME);
    let mut installer_guard = open_verified_installer(&installer, manifest.size, &manifest.sha256)?;
    // Open and retain the handle BEFORE readiness. PID reuse cannot switch us
    // to a different process while we wait for the updater's parent to exit.
    let parent = ParentProcess::open(manifest.parent_pid)?;
    write_new(
        &job.join(READY_NAME),
        std::process::id().to_string().as_bytes(),
    )?;
    // Normal interactive NSIS execution migrates portable users' shortcuts and
    // lets Windows show any required installer prompt. No /UPDATE or /NS flags.
    finish_after_parent_exit(
        || parent.wait(),
        || verify_installer_file(&mut installer_guard, manifest.size, &manifest.sha256),
        || {
            open::that(&installer)
                .map_err(|_| "Windows could not start the verified installer.".into())
        },
        show_handoff_error,
    )
}

#[cfg(windows)]
fn show_handoff_error(message: &str) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        MessageBoxW, MB_ICONERROR, MB_OK, MB_SETFOREGROUND,
    };
    let text: Vec<u16> = format!("Dino Lab could not complete the update.\n\n{message}\n\nReopen Dino Lab from its shortcut and try Update now again, or download the installer from the GitHub release page.").encode_utf16().chain(Some(0)).collect();
    let title: Vec<u16> = "Dino Lab update".encode_utf16().chain(Some(0)).collect();
    unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            text.as_ptr(),
            title.as_ptr(),
            MB_OK | MB_ICONERROR | MB_SETFOREGROUND,
        );
    }
}

/// Runs before Tauri context, GUI and single-instance initialization. The helper
/// is a cache copy, so waiting here never holds the app's original image open.
pub fn run_handoff_if_requested() -> Option<i32> {
    let args: Vec<_> = std::env::args_os().collect();
    if !args.iter().any(|arg| arg == HELPER_FLAG) {
        return None;
    }
    if args.len() != 2 {
        return Some(2);
    }
    let job = std::env::current_exe()
        .ok()
        .and_then(|path| helper_job(&path).ok());
    let Some(job) = job else {
        return Some(2);
    };
    #[cfg(windows)]
    let result = run_helper(&job);
    #[cfg(not(windows))]
    let result: Result<(), String> =
        Err("Windows installers are unsupported on this platform.".into());
    match result {
        Ok(()) => Some(0),
        Err(message) => {
            let _ = fs::write(job.join("handoff-error.txt"), message);
            Some(1)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;

    struct Fixture(PathBuf);
    impl Fixture {
        fn new(bytes: &[u8]) -> Self {
            let path = std::env::temp_dir().join(format!(
                "dino-lab-installer-test-{}-{}",
                std::process::id(),
                JOB_SEQUENCE.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir(&path).unwrap();
            fs::write(path.join(INSTALLER_NAME), bytes).unwrap();
            Self(path)
        }
        fn file(&self) -> PathBuf {
            self.0.join(INSTALLER_NAME)
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_file(self.file());
            let _ = fs::remove_dir(&self.0);
        }
    }
    fn pe_bytes() -> Vec<u8> {
        let mut bytes = vec![0; 256];
        bytes[..2].copy_from_slice(b"MZ");
        bytes[60..64].copy_from_slice(&64u32.to_le_bytes());
        bytes[64..68].copy_from_slice(b"PE\0\0");
        bytes
    }
    fn hash(bytes: &[u8]) -> String {
        format!("{:x}", Sha256::digest(bytes))
    }

    #[test]
    fn validates_complete_hash_and_windows_header_without_executing_any_file() {
        let bytes = pe_bytes();
        let fixture = Fixture::new(&bytes);
        assert!(verify_installer(&fixture.file(), 256, &hash(&bytes)).is_ok());
        assert!(verify_installer(&fixture.file(), 255, &hash(&bytes)).is_err());
        assert!(verify_installer(&fixture.file(), 256, &"00".repeat(32)).is_err());
        for mutation in [0, 64, 60] {
            let mut invalid = bytes.clone();
            invalid[mutation] = 0xff;
            fs::write(fixture.file(), &invalid).unwrap();
            assert!(verify_installer(&fixture.file(), 256, &hash(&invalid)).is_err());
        }
        let mut changed = bytes.clone();
        changed[200] = 42;
        fs::write(fixture.file(), changed).unwrap();
        assert!(
            verify_installer(&fixture.file(), 256, &hash(&bytes)).is_err(),
            "post-download tampering is rejected"
        );
    }

    #[test]
    fn download_stream_rejects_truncation_overflow_and_oversize() {
        assert_eq!(checked_download_size(64, 64, 128).unwrap(), 128);
        assert!(checked_download_size(64, 65, 128).is_err());
        assert!(checked_download_size(u64::MAX, 1, u64::MAX).is_err());
        assert!(checked_download_size(MAX_INSTALLER_BYTES, 1, MAX_INSTALLER_BYTES + 1).is_err());
    }

    #[test]
    fn redirects_are_https_and_exact_github_download_hosts() {
        for value in [
            "https://github.com/Chucksterboy/dino-lab/releases/download/v1.2.3/Setup.exe",
            "https://release-assets.githubusercontent.com/github-production-release-asset/1/2?signature=example",
            "https://objects.githubusercontent.com/github-production-release-asset/1/2?signature=example",
        ] { assert!(safe_download_redirect(&url::Url::parse(value).unwrap()), "{value}"); }
        for value in [
            "http://release-assets.githubusercontent.com/a", "https://evil.example/a",
            "https://release-assets.githubusercontent.com.evil.example/a", "https://user@objects.githubusercontent.com/a",
            "https://objects.githubusercontent.com:8443/a", "https://github.com/other/repo/releases/download/v1.2.3/Setup.exe",
            "https://github.com/Chucksterboy/dino-lab/releases/download/v1.2.3/Setup.exe?redirect=other",
            "https://objects.githubusercontent.com/a#fragment",
        ] { assert!(!safe_download_redirect(&url::Url::parse(value).unwrap()), "{value}"); }
    }

    #[test]
    fn readiness_requires_live_matching_helper_and_job_path_is_generated() {
        assert!(!ready_for_exit(None, 123, true).unwrap());
        assert!(!ready_for_exit(Some("122"), 123, true).unwrap());
        assert!(ready_for_exit(Some("123"), 123, true).unwrap());
        assert!(ready_for_exit(Some("123"), 123, false).is_err());
        let root = std::env::temp_dir();
        let good = root
            .join("updates")
            .join("dino-lab-update-123-456-0")
            .join(HELPER_NAME);
        assert!(helper_job(&good).is_ok());
        assert!(helper_job(&root.join(HELPER_NAME)).is_err());
        assert!(helper_job(&root.join("updates").join("arbitrary").join(HELPER_NAME)).is_err());
        assert!(helper_job(
            &root
                .join("updates")
                .join("dino-lab-update-123-456-0")
                .join("app.exe")
        )
        .is_err());
    }

    #[test]
    fn handoff_metadata_disallows_same_or_older_versions_and_invalid_bounds() {
        let current = semver::Version::parse(env!("CARGO_PKG_VERSION")).unwrap();
        let mut manifest = Handoff {
            parent_pid: std::process::id() + 1,
            version: format!("{}.{}.{}", current.major, current.minor, current.patch + 1),
            size: 256,
            sha256: "ab".repeat(32),
        };
        assert!(validate_handoff(&manifest).is_ok());
        let next = manifest.version.clone();
        manifest.version = current.to_string();
        assert!(validate_handoff(&manifest).is_err());
        manifest.version = "9000.0.0-beta.1".into();
        assert!(validate_handoff(&manifest).is_err());
        manifest.version = next;
        manifest.parent_pid = std::process::id();
        assert!(validate_handoff(&manifest).is_err());
        manifest.parent_pid = 0;
        assert!(validate_handoff(&manifest).is_err());
        manifest.parent_pid = std::process::id() + 1;
        manifest.size = MAX_INSTALLER_BYTES + 1;
        assert!(validate_handoff(&manifest).is_err());
        manifest.size = 256;
        manifest.sha256 = "not-a-digest".into();
        assert!(validate_handoff(&manifest).is_err());
    }

    #[test]
    fn installation_handoff_waits_then_reverifies_and_reports_post_exit_failures() {
        let calls = RefCell::new(Vec::new());
        finish_after_parent_exit(
            || {
                calls.borrow_mut().push("parent-exited");
                Ok(())
            },
            || {
                calls.borrow_mut().push("verified-after-exit");
                Ok(())
            },
            || {
                calls.borrow_mut().push("installer-launch");
                Ok(())
            },
            |_| panic!("success must not show an error"),
        )
        .unwrap();
        assert_eq!(
            *calls.borrow(),
            ["parent-exited", "verified-after-exit", "installer-launch"]
        );
        calls.borrow_mut().clear();
        assert!(finish_after_parent_exit(
            || Err("wait failed".into()),
            || {
                calls.borrow_mut().push("verify");
                Ok(())
            },
            || {
                calls.borrow_mut().push("launch");
                Ok(())
            },
            |_| calls.borrow_mut().push("native-error"),
        )
        .is_err());
        assert!(
            calls.borrow().is_empty(),
            "pre-exit failures stay with the parent UI, without a second message box"
        );
        assert!(finish_after_parent_exit(
            || Ok(()),
            || Err("tampered".into()),
            || {
                calls.borrow_mut().push("launch");
                Ok(())
            },
            |error| {
                assert_eq!(error, "tampered");
                calls.borrow_mut().push("native-error");
            },
        )
        .is_err());
        assert_eq!(
            *calls.borrow(),
            ["native-error"],
            "post-exit tampering is reported and never launched"
        );
        calls.borrow_mut().clear();
        assert!(finish_after_parent_exit(
            || Ok(()),
            || Ok(()),
            || Err("Windows blocked setup".into()),
            |error| {
                assert_eq!(error, "Windows blocked setup");
                calls.borrow_mut().push("native-error");
            },
        )
        .is_err());
        assert_eq!(
            *calls.borrow(),
            ["native-error"],
            "post-exit ShellExecute failure is visible and actionable"
        );
    }

    #[cfg(windows)]
    #[test]
    fn verified_installer_handle_denies_new_writers_until_launch_guard_is_released() {
        let bytes = pe_bytes();
        let fixture = Fixture::new(&bytes);
        let mut guard = open_verified_installer(&fixture.file(), 256, &hash(&bytes)).unwrap();
        assert!(OpenOptions::new().write(true).open(fixture.file()).is_err());
        verify_installer_file(&mut guard, 256, &hash(&bytes)).unwrap();
        assert!(
            File::open(fixture.file()).is_ok(),
            "installer loader can still read it"
        );
        drop(guard);
        assert!(OpenOptions::new().write(true).open(fixture.file()).is_ok());
    }

    #[test]
    fn install_requests_are_exclusive_and_failure_unlocks_retry() {
        let first = InstallGuard::acquire().unwrap();
        assert!(InstallGuard::acquire().is_err());
        drop(first);
        assert!(InstallGuard::acquire().is_ok());
    }
}
