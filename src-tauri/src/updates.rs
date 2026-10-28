use reqwest::{header::HeaderMap, redirect::Policy, Client, StatusCode};
use semver::Version;
use serde::{Deserialize, Serialize};
use std::{
    cmp::Ordering,
    sync::atomic::{AtomicU64, Ordering as AtomicOrdering},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");
const REQUEST_DEADLINE: Duration = Duration::from_secs(8);
const MAX_JSON_BYTES: usize = 512 * 1024;
static NEXT_CHECK_UNIX: AtomicU64 = AtomicU64::new(0);

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[derive(Clone, Debug, Deserialize)]
struct UpdateConfig {
    owner: String,
    repo: String,
}

impl UpdateConfig {
    fn validate(self) -> Result<Self, &'static str> {
        let valid_part = |part: &str| {
            !part.is_empty()
                && part.len() <= 100
                && part != "."
                && part != ".."
                && part.chars().all(|character| {
                    character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')
                })
        };
        if !valid_part(&self.owner) || !valid_part(&self.repo) {
            return Err("The release repository configuration is invalid.");
        }
        Ok(self)
    }

    fn api_url(&self, suffix: &str) -> String {
        format!(
            "https://api.github.com/repos/{}/{}{}",
            self.owner, self.repo, suffix
        )
    }
}

fn config() -> Result<UpdateConfig, &'static str> {
    serde_json::from_str::<UpdateConfig>(include_str!("../update-config.json"))
        .map_err(|_| "The release repository configuration is invalid.")?
        .validate()
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum UpdateStatus {
    Available,
    Current,
    Unpublished,
    Unavailable,
    Offline,
    RateLimited,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheck {
    status: UpdateStatus,
    current_version: String,
    latest_version: Option<String>,
    release_url: Option<String>,
    release_name: Option<String>,
    published_at: Option<String>,
    message: Option<String>,
    checked_at_unix: u64,
    installer_available: bool,
}

impl UpdateCheck {
    fn state(status: UpdateStatus, message: impl Into<String>) -> Self {
        Self {
            status,
            current_version: CURRENT_VERSION.into(),
            latest_version: None,
            release_url: None,
            release_name: None,
            published_at: None,
            message: Some(message.into()),
            installer_available: false,
            checked_at_unix: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        }
    }
}

fn parse_version(value: &str) -> Result<Version, semver::Error> {
    let value = value.trim();
    Version::parse(
        value
            .strip_prefix('v')
            .or_else(|| value.strip_prefix('V'))
            .unwrap_or(value),
    )
}

fn version_precedence(current: &str, latest: &str) -> Result<Ordering, semver::Error> {
    Ok(parse_version(latest)?.cmp_precedence(&parse_version(current)?))
}

fn safe_api_url(url: &url::Url) -> bool {
    url.scheme() == "https"
        && url.host_str() == Some("api.github.com")
        && url.username().is_empty()
        && url.password().is_none()
        && url.port().map_or(true, |port| port == 443)
        && (url.path().starts_with("/repos/") || url.path().starts_with("/repositories/"))
}

fn verified_release_url(input: &str, config: &UpdateConfig) -> Result<url::Url, &'static str> {
    let url = url::Url::parse(input).map_err(|_| "The release URL is invalid.")?;
    let base = format!("/{}/{}/releases", config.owner, config.repo).to_ascii_lowercase();
    let path = url.path().to_ascii_lowercase();
    let is_release = path == base
        || path == format!("{base}/")
        || (path.starts_with(&format!("{base}/tag/")) && path.len() > base.len() + 5);
    if url.scheme() != "https"
        || url.host_str() != Some("github.com")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some_and(|port| port != 443)
        || !is_release
        || path.contains("%2f")
        || path.contains("%5c")
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("Only the configured Dino Lab GitHub release page can be opened.");
    }
    Ok(url)
}

fn client() -> Result<Client, reqwest::Error> {
    Client::builder()
        .user_agent(concat!("Dino-Lab/", env!("CARGO_PKG_VERSION")))
        .https_only(true)
        .timeout(REQUEST_DEADLINE)
        .connect_timeout(Duration::from_secs(4))
        .referer(false)
        .redirect(Policy::custom(|attempt| {
            if attempt.previous().len() >= 3 {
                attempt.error("Too many GitHub API redirects")
            } else if safe_api_url(attempt.url()) {
                attempt.follow()
            } else {
                attempt.error("GitHub API redirected outside its trusted HTTPS API")
            }
        }))
        .build()
}

fn network_failure(error: reqwest::Error) -> UpdateCheck {
    if error.is_redirect() {
        UpdateCheck::state(
            UpdateStatus::Unavailable,
            "GitHub returned an unsupported release-check redirect.",
        )
    } else {
        UpdateCheck::state(
            UpdateStatus::Offline,
            "Could not reach GitHub. Try checking again when you're online.",
        )
    }
}

struct ApiResponse {
    status: StatusCode,
    headers: HeaderMap,
    body: Vec<u8>,
}

fn append_capped(body: &mut Vec<u8>, chunk: &[u8]) -> Result<(), &'static str> {
    if body.len().saturating_add(chunk.len()) > MAX_JSON_BYTES {
        return Err("GitHub returned an unexpectedly large release response.");
    }
    body.extend_from_slice(chunk);
    Ok(())
}

async fn fetch(client: &Client, url: String) -> Result<ApiResponse, UpdateCheck> {
    let mut response = client
        .get(url)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2026-03-10")
        .send()
        .await
        .map_err(network_failure)?;
    let status = response.status();
    let headers = response.headers().clone();
    if response
        .content_length()
        .is_some_and(|length| length > MAX_JSON_BYTES as u64)
    {
        return Err(UpdateCheck::state(
            UpdateStatus::Unavailable,
            "GitHub returned an unexpectedly large release response.",
        ));
    }
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(network_failure)? {
        append_capped(&mut body, &chunk)
            .map_err(|message| UpdateCheck::state(UpdateStatus::Unavailable, message))?;
    }
    Ok(ApiResponse {
        status,
        headers,
        body,
    })
}

fn retry_delay(headers: &HeaderMap, now: u64) -> u64 {
    let retry_after = headers
        .get("retry-after")
        .and_then(|value| value.to_str().ok());
    let seconds = retry_after
        .and_then(|value| value.parse::<u64>().ok())
        .or_else(|| {
            retry_after
                .and_then(|value| httpdate::parse_http_date(value).ok())
                .and_then(|date| date.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_secs().saturating_sub(now))
        })
        .or_else(|| {
            headers
                .get("x-ratelimit-reset")
                .and_then(|value| value.to_str().ok())
                .and_then(|value| value.parse::<u64>().ok())
                .map(|reset| reset.saturating_sub(now))
        })
        .unwrap_or(60);
    seconds.clamp(1, 86_400)
}

fn remember_rate_limit(headers: &HeaderMap) {
    let now = unix_now();
    NEXT_CHECK_UNIX.fetch_max(
        now.saturating_add(retry_delay(headers, now)),
        AtomicOrdering::Relaxed,
    );
}

fn rate_limit(response: &ApiResponse) -> Option<UpdateCheck> {
    let remaining = response
        .headers
        .get("x-ratelimit-remaining")
        .and_then(|value| value.to_str().ok());
    let retry_after = response
        .headers
        .get("retry-after")
        .and_then(|value| value.to_str().ok());
    let body_message = serde_json::from_slice::<serde_json::Value>(&response.body)
        .ok()
        .and_then(|value| {
            value
                .get("message")
                .and_then(|value| value.as_str())
                .map(str::to_ascii_lowercase)
        })
        .unwrap_or_default();
    let limited = response.status == StatusCode::TOO_MANY_REQUESTS
        || (response.status == StatusCode::FORBIDDEN
            && (remaining == Some("0")
                || retry_after.is_some()
                || body_message.contains("rate limit")
                || body_message.contains("abuse detection")));
    if !limited {
        return None;
    }
    let message = format!(
        "GitHub's check limit was reached. Try again in {} seconds.",
        retry_delay(&response.headers, unix_now())
    );
    Some(UpdateCheck::state(UpdateStatus::RateLimited, message))
}

#[derive(Deserialize)]
struct GithubRelease {
    tag_name: String,
    html_url: String,
    draft: bool,
    prerelease: bool,
    name: Option<String>,
    published_at: Option<String>,
    #[serde(default)]
    assets: Vec<GithubAsset>,
}

#[derive(Deserialize)]
struct GithubAsset {
    name: String,
    state: String,
    size: u64,
    browser_download_url: String,
    #[serde(default)]
    digest: Option<String>,
}

fn usable_windows_asset(asset: &GithubAsset, config: &UpdateConfig) -> bool {
    let name = asset.name.to_ascii_lowercase();
    if asset.state != "uploaded"
        || asset.size == 0
        || !(name.ends_with(".exe") || name.ends_with(".msi"))
    {
        return false;
    }
    let Ok(url) = url::Url::parse(&asset.browser_download_url) else {
        return false;
    };
    let prefix =
        format!("/{}/{}/releases/download/", config.owner, config.repo).to_ascii_lowercase();
    let path = url.path().to_ascii_lowercase();
    url.scheme() == "https"
        && url.host_str() == Some("github.com")
        && url.username().is_empty()
        && url.password().is_none()
        && url.port().map_or(true, |port| port == 443)
        && url.query().is_none()
        && url.fragment().is_none()
        && path.starts_with(&prefix)
        && path[prefix.len()..].split('/').count() >= 2
        && (path.ends_with(".exe") || path.ends_with(".msi"))
}

fn missing_release_result(metadata: &ApiResponse, config: &UpdateConfig) -> UpdateCheck {
    if metadata.status == StatusCode::OK {
        if let Ok(value) = serde_json::from_slice::<serde_json::Value>(&metadata.body) {
            let full_name = format!("{}/{}", config.owner, config.repo);
            if value.get("private").and_then(|value| value.as_bool()) == Some(false)
                && value
                    .get("full_name")
                    .and_then(|value| value.as_str())
                    .is_some_and(|value| value.eq_ignore_ascii_case(&full_name))
            {
                return UpdateCheck::state(
                    UpdateStatus::Unpublished,
                    "No stable version has been published to GitHub Releases yet.",
                );
            }
        }
    }
    UpdateCheck::state(
        UpdateStatus::Unavailable,
        "The release repository is unavailable or not publicly accessible.",
    )
}

fn release_result(body: &[u8], config: &UpdateConfig, current: &str) -> UpdateCheck {
    let Ok(release) = serde_json::from_slice::<GithubRelease>(body) else {
        return UpdateCheck::state(
            UpdateStatus::Unavailable,
            "GitHub returned an unreadable release response.",
        );
    };
    let Ok(latest) = parse_version(&release.tag_name) else {
        return UpdateCheck::state(
            UpdateStatus::Unavailable,
            "The latest release tag is not a valid version number.",
        );
    };
    if release.draft
        || release.prerelease
        || !latest.pre.is_empty()
        || release
            .published_at
            .as_ref()
            .map_or(true, |value| value.trim().is_empty())
    {
        return UpdateCheck::state(
            UpdateStatus::Unavailable,
            "No published stable release could be verified.",
        );
    }
    let Ok(url) = verified_release_url(&release.html_url, config) else {
        return UpdateCheck::state(
            UpdateStatus::Unavailable,
            "The release page did not match the configured repository.",
        );
    };
    if !release
        .assets
        .iter()
        .any(|asset| usable_windows_asset(asset, config))
    {
        return UpdateCheck::state(UpdateStatus::Unavailable,"The latest release does not have a finished Windows installer or application asset yet.");
    }
    let Ok(ordering) = version_precedence(current, &release.tag_name) else {
        return UpdateCheck::state(
            UpdateStatus::Unavailable,
            "The installed version could not be compared with this release.",
        );
    };
    let (status, message) = match ordering {
        Ordering::Greater => (
            UpdateStatus::Available,
            format!("Dino Lab {latest} is available."),
        ),
        Ordering::Equal => (
            UpdateStatus::Current,
            "You're using the latest published release.".into(),
        ),
        Ordering::Less => (
            UpdateStatus::Current,
            "Your installed version is newer than the latest published release.".into(),
        ),
    };
    let mut result = UpdateCheck::state(status, message);
    result.current_version = current.into();
    result.latest_version = Some(latest.to_string());
    result.release_url = Some(url.into());
    result.installer_available =
        ordering == Ordering::Greater && select_installer(&release, config).is_some();
    result.release_name = release
        .name
        .filter(|value| !value.trim().is_empty())
        .map(|value| value.chars().take(200).collect());
    result.published_at = release.published_at;
    result
}

/// Only this native metadata path supplies an executable URL to the downloader.
#[derive(Clone, Debug)]
pub(crate) struct InstallerPlan {
    pub version: String,
    pub url: String,
    pub sha256: String,
    pub size: u64,
}

pub(crate) const MAX_INSTALLER_BYTES: u64 = 512 * 1024 * 1024;

fn digest_hex(value: &str) -> Option<String> {
    let (algorithm, hex) = value.split_once(':')?;
    (algorithm.eq_ignore_ascii_case("sha256")
        && hex.len() == 64
        && hex.bytes().all(|byte| byte.is_ascii_hexdigit()))
    .then(|| hex.to_ascii_lowercase())
}

fn select_installer(release: &GithubRelease, config: &UpdateConfig) -> Option<InstallerPlan> {
    let version = parse_version(&release.tag_name).ok()?;
    if !version.pre.is_empty() || release.draft || release.prerelease {
        return None;
    }
    release.assets.iter().find_map(|asset| {
        let name = asset.name.to_ascii_lowercase();
        let tokens: Vec<_> = name.split(|c: char| !c.is_ascii_alphanumeric()).collect();
        if !usable_windows_asset(asset, config)
            || !name.ends_with(".exe")
            || !tokens
                .iter()
                .any(|token| matches!(*token, "setup" | "installer"))
            || tokens.iter().any(|token| {
                matches!(
                    *token,
                    "portable" | "arm64" | "aarch64" | "x86" | "i686" | "win32"
                )
            })
            || asset.size < 64
            || asset.size > MAX_INSTALLER_BYTES
        {
            return None;
        }
        let mut expected_url = url::Url::parse("https://github.com/").ok()?;
        expected_url.path_segments_mut().ok()?.clear().extend([
            config.owner.as_str(),
            config.repo.as_str(),
            "releases",
            "download",
            release.tag_name.as_str(),
            asset.name.as_str(),
        ]);
        if asset.browser_download_url != expected_url.as_str() {
            return None;
        }
        Some(InstallerPlan {
            version: version.to_string(),
            url: asset.browser_download_url.clone(),
            sha256: digest_hex(asset.digest.as_deref()?)?,
            size: asset.size,
        })
    })
}

fn installer_plan(
    body: &[u8],
    config: &UpdateConfig,
    current: &str,
    expected: &str,
) -> Result<InstallerPlan, String> {
    let status = release_result(body, config, current);
    if status.status != UpdateStatus::Available {
        return Err(
            "A newer stable update is no longer available. Check for updates again.".into(),
        );
    }
    let release: GithubRelease = serde_json::from_slice(body)
        .map_err(|_| "GitHub returned an unreadable update response.")?;
    let expected =
        parse_version(expected).map_err(|_| "The selected update version is invalid.")?;
    let plan = select_installer(&release, config)
        .ok_or("This release has no verified Windows installer. Open its release page instead.")?;
    if plan.version != expected.to_string() {
        return Err(
            "The latest version changed. Check for updates again before installing.".into(),
        );
    }
    Ok(plan)
}

pub(crate) async fn latest_installer(expected: &str) -> Result<InstallerPlan, String> {
    if expected.len() > 128 || parse_version(expected).is_err() {
        return Err("The selected update version is invalid.".into());
    }
    if NEXT_CHECK_UNIX.load(AtomicOrdering::Relaxed) > unix_now() {
        return Err("GitHub is limiting update requests. Please try again later.".into());
    }
    let config = config().map_err(str::to_string)?;
    let client = client().map_err(|_| "Could not connect to GitHub.")?;
    let response = fetch(&client, config.api_url("/releases/latest"))
        .await
        .map_err(|result| {
            result
                .message
                .unwrap_or_else(|| "Could not check GitHub for the installer.".into())
        })?;
    if let Some(result) = rate_limit(&response) {
        remember_rate_limit(&response.headers);
        return Err(result
            .message
            .unwrap_or_else(|| "GitHub is limiting update requests.".into()));
    }
    if response.status != StatusCode::OK {
        return Err("The latest installer could not be checked. Please try again.".into());
    }
    installer_plan(&response.body, &config, CURRENT_VERSION, expected)
}

async fn check(client: Client, config: UpdateConfig) -> UpdateCheck {
    let latest = match fetch(&client, config.api_url("/releases/latest")).await {
        Ok(response) => response,
        Err(result) => return result,
    };
    if let Some(result) = rate_limit(&latest) {
        remember_rate_limit(&latest.headers);
        return result;
    }
    if latest.status == StatusCode::NOT_FOUND {
        // 404 also means private/inaccessible/wrong repo, so do not infer
        // "current" or even "unpublished" without a public metadata response.
        let metadata = match fetch(&client, config.api_url("")).await {
            Ok(response) => response,
            Err(result) => return result,
        };
        if let Some(result) = rate_limit(&metadata) {
            remember_rate_limit(&metadata.headers);
            return result;
        }
        return missing_release_result(&metadata, &config);
    }
    if latest.status != StatusCode::OK {
        return UpdateCheck::state(
            UpdateStatus::Unavailable,
            "GitHub could not provide the latest release. Please try again later.",
        );
    }
    release_result(&latest.body, &config, CURRENT_VERSION)
}

/// Performs an unauthenticated read of the configured public GitHub Releases
/// endpoint. Every failure is a status, never a false "up to date" response.
#[tauri::command]
pub async fn check_for_updates() -> UpdateCheck {
    let remaining = NEXT_CHECK_UNIX
        .load(AtomicOrdering::Relaxed)
        .saturating_sub(unix_now());
    if remaining > 0 {
        return UpdateCheck::state(
            UpdateStatus::RateLimited,
            format!("GitHub's check limit was reached. Try again in {remaining} seconds."),
        );
    }
    let config = match config() {
        Ok(value) => value,
        Err(message) => return UpdateCheck::state(UpdateStatus::Unavailable, message),
    };
    let client = match client() {
        Ok(value) => value,
        Err(_) => {
            return UpdateCheck::state(
                UpdateStatus::Offline,
                "The version checker could not connect to GitHub.",
            )
        }
    };
    match tokio::time::timeout(REQUEST_DEADLINE, check(client, config)).await {
        Ok(result) => result,
        Err(_) => UpdateCheck::state(
            UpdateStatus::Offline,
            "The GitHub version check timed out. Please try again later.",
        ),
    }
}

#[tauri::command]
pub async fn open_update_release(url: String) -> Result<(), String> {
    let config = config().map_err(str::to_string)?;
    let url = verified_release_url(&url, &config).map_err(str::to_string)?;
    tauri::async_runtime::spawn_blocking(move || {
        open::that_detached(url.as_str())
            .map_err(|error| format!("Could not open the release page: {error}"))
    })
    .await
    .map_err(|error| format!("Could not open the release page: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> UpdateConfig {
        UpdateConfig {
            owner: "Chucksterboy".into(),
            repo: "dino-lab".into(),
        }
    }
    fn release(tag: &str) -> Vec<u8> {
        serde_json::to_vec(&serde_json::json!({"tag_name":tag,"html_url":format!("https://github.com/Chucksterboy/dino-lab/releases/tag/{tag}"),"draft":false,"prerelease":false,"name":"Release","published_at":"2026-10-28T00:00:00Z","assets":[{"name":"Dino Lab Setup.exe","state":"uploaded","size":4096,"browser_download_url":format!("https://github.com/Chucksterboy/dino-lab/releases/download/{tag}/Dino.Lab.Setup.exe")}]})).unwrap()
    }

    fn installer_release(tag: &str) -> serde_json::Value {
        let mut value: serde_json::Value = serde_json::from_slice(&release(tag)).unwrap();
        let asset = |kind: &str| {
            serde_json::json!({
                "name": format!("Dino-Lab-{}-Windows-{kind}.exe", tag.trim_start_matches('v')),
                "state": "uploaded", "size": 4096, "digest": format!("sha256:{}", "ab".repeat(32)),
                "browser_download_url": format!("https://github.com/Chucksterboy/dino-lab/releases/download/{tag}/Dino-Lab-{}-Windows-{kind}.exe", tag.trim_start_matches('v'))
            })
        };
        value["assets"] = serde_json::json!([asset("Portable"), asset("Setup")]);
        value
    }

    #[test]
    fn clicked_install_selects_only_a_verified_setup_for_the_expected_newer_release() {
        let value = installer_release("v9.0.0");
        let body = serde_json::to_vec(&value).unwrap();
        let plan = installer_plan(&body, &test_config(), "1.0.0", "9.0.0").unwrap();
        assert!(plan.url.ends_with("Windows-Setup.exe"));
        assert_eq!(plan.sha256, "ab".repeat(32));
        assert_eq!(plan.size, 4096);
        assert_eq!(plan.version, "9.0.0");
        assert!(release_result(&body, &test_config(), "1.0.0").installer_available);
        for (current, expected) in [
            ("9.0.0", "9.0.0"),
            ("10.0.0", "9.0.0"),
            ("1.0.0", "8.0.0"),
            ("1.0.0", "invalid"),
        ] {
            assert!(installer_plan(&body, &test_config(), current, expected).is_err());
        }
        assert!(!release_result(&body, &test_config(), "9.0.0").installer_available);
    }

    #[test]
    fn install_capability_requires_digest_correct_tag_and_real_setup_asset() {
        let original = installer_release("v9.0.0");
        let wrong = [
            ("digest", serde_json::Value::Null),
            ("digest", serde_json::json!("sha256:short")),
            (
                "digest",
                serde_json::json!(format!("sha512:{}", "ab".repeat(32))),
            ),
            ("size", serde_json::json!(0)),
            ("size", serde_json::json!(MAX_INSTALLER_BYTES + 1)),
            ("state", serde_json::json!("new")),
            ("name", serde_json::json!("Dino-Lab-Windows-Portable.exe")),
            ("name", serde_json::json!("Dino-Lab-arm64-Setup.exe")),
            (
                "browser_download_url",
                serde_json::json!("https://evil.example/Setup.exe"),
            ),
            (
                "browser_download_url",
                serde_json::json!(
                    "https://github.com/Chucksterboy/dino-lab/releases/download/v8.0.0/Setup.exe"
                ),
            ),
            (
                "browser_download_url",
                serde_json::json!(
                    "https://github.com/Chucksterboy/other/releases/download/v9.0.0/Setup.exe"
                ),
            ),
        ];
        for (field, invalid) in wrong {
            let mut value = original.clone();
            value["assets"][1][field] = invalid;
            assert!(
                select_installer(
                    &serde_json::from_value(value.clone()).unwrap(),
                    &test_config()
                )
                .is_none(),
                "{field}: {value}"
            );
            assert!(installer_plan(
                &serde_json::to_vec(&value).unwrap(),
                &test_config(),
                "1.0.0",
                "9.0.0"
            )
            .is_err());
        }
        for field in ["draft", "prerelease"] {
            let mut value = original.clone();
            value[field] = serde_json::json!(true);
            assert!(installer_plan(
                &serde_json::to_vec(&value).unwrap(),
                &test_config(),
                "1.0.0",
                "9.0.0"
            )
            .is_err());
        }
        let mut portable_only = original;
        portable_only["assets"].as_array_mut().unwrap().pop();
        let result = release_result(
            &serde_json::to_vec(&portable_only).unwrap(),
            &test_config(),
            "1.0.0",
        );
        assert_eq!(result.status, UpdateStatus::Available);
        assert!(
            !result.installer_available,
            "a release-page fallback remains possible without executing the portable asset"
        );
    }

    #[test]
    fn compares_real_semver_and_ignores_build_metadata() {
        for (current, latest, expected) in [
            ("0.1.9", "v0.1.10", Ordering::Greater),
            ("1.9.0", "V1.10.0", Ordering::Greater),
            ("1.0.0-rc.1", "v1.0.0", Ordering::Greater),
            ("1.0.0", "v1.0.0-rc.1", Ordering::Less),
            ("1.0.0-beta.9", "1.0.0-beta.10", Ordering::Greater),
            ("1.0.0+one", "v1.0.0+two", Ordering::Equal),
        ] {
            assert_eq!(
                version_precedence(current, latest).unwrap(),
                expected,
                "{current} / {latest}"
            );
        }
        for tag in ["latest", "v1.2", "v01.2.3", "1.2.3oops", ""] {
            assert!(parse_version(tag).is_err(), "{tag}");
        }
    }

    #[test]
    fn rejects_private_and_other_non_release_responses() {
        for body in [
            br#"{"message":"Not Found"}"#.as_slice(),
            br#"{}"#.as_slice(),
            b"not JSON".as_slice(),
        ] {
            assert_eq!(
                release_result(body, &test_config(), "0.1.3").status,
                UpdateStatus::Unavailable
            );
        }
        assert_eq!(
            release_result(&release("nonsense"), &test_config(), "0.1.3").status,
            UpdateStatus::Unavailable
        );
    }

    #[test]
    fn stable_release_results_are_truthful() {
        assert_eq!(
            release_result(&release("v0.1.10"), &test_config(), "0.1.9").status,
            UpdateStatus::Available
        );
        assert_eq!(
            release_result(&release("v0.1.3"), &test_config(), "0.1.3").status,
            UpdateStatus::Current
        );
        assert_eq!(
            release_result(&release("v0.1.2"), &test_config(), "0.1.3").status,
            UpdateStatus::Current
        );
        assert_eq!(
            release_result(&release("v0.2.0-beta.1"), &test_config(), "0.1.3").status,
            UpdateStatus::Unavailable
        );
        let mut value: serde_json::Value = serde_json::from_slice(&release("v0.2.0")).unwrap();
        value["draft"] = serde_json::json!(true);
        assert_eq!(
            release_result(
                &serde_json::to_vec(&value).unwrap(),
                &test_config(),
                "0.1.3"
            )
            .status,
            UpdateStatus::Unavailable
        );
        value["draft"] = serde_json::json!(false);
        value["prerelease"] = serde_json::json!(true);
        assert_eq!(
            release_result(
                &serde_json::to_vec(&value).unwrap(),
                &test_config(),
                "0.1.3"
            )
            .status,
            UpdateStatus::Unavailable
        );
        value["prerelease"] = serde_json::json!(false);
        value["published_at"] = serde_json::Value::Null;
        assert_eq!(
            release_result(
                &serde_json::to_vec(&value).unwrap(),
                &test_config(),
                "0.1.3"
            )
            .status,
            UpdateStatus::Unavailable
        );
    }

    #[test]
    fn release_links_are_scoped_to_the_configured_https_repository() {
        for url in [
            "https://github.com/Chucksterboy/dino-lab/releases",
            "https://github.com/Chucksterboy/dino-lab/releases/tag/v1.2.3",
        ] {
            assert!(verified_release_url(url, &test_config()).is_ok(), "{url}");
        }
        for url in [
            "http://github.com/Chucksterboy/dino-lab/releases",
            "https://github.com.evil.example/Chucksterboy/dino-lab/releases",
            "https://github.com@evil.example/Chucksterboy/dino-lab/releases",
            "https://user@github.com/Chucksterboy/dino-lab/releases",
            "https://github.com:8443/Chucksterboy/dino-lab/releases",
            "https://github.com/Chucksterboy/other/releases",
            "https://github.com/Chucksterboy/dino-lab/releases-evil",
            "https://github.com/Chucksterboy/dino-lab/releases/download/v1.2.3/app.exe",
            "https://github.com/Chucksterboy/dino-lab/releases?next=https://evil.example",
            "https://github.com/Chucksterboy/dino-lab/releases/tag/%2e%2e%2f%2e%2e%2fother",
        ] {
            assert!(verified_release_url(url, &test_config()).is_err(), "{url}");
        }
    }

    #[test]
    fn redirects_only_follow_trusted_https_github_api_urls() {
        for url in [
            "https://api.github.com/repos/Chucksterboy/dino-lab/releases/latest",
            "https://api.github.com/repositories/123/releases/latest",
        ] {
            assert!(safe_api_url(&url::Url::parse(url).unwrap()));
        }
        for url in [
            "http://api.github.com/repos/a/b",
            "https://api.github.com.evil.example/repos/a/b",
            "https://evil.example/repos/a/b",
            "https://api.github.com:8443/repos/a/b",
            "https://user@api.github.com/repos/a/b",
            "https://api.github.com/search/code",
        ] {
            assert!(!safe_api_url(&url::Url::parse(url).unwrap()));
        }
    }

    #[test]
    fn rate_limit_statuses_do_not_masquerade_as_current() {
        let response = |status| ApiResponse {
            status,
            headers: HeaderMap::new(),
            body: br#"{"message":"Forbidden"}"#.to_vec(),
        };
        assert_eq!(
            rate_limit(&response(StatusCode::TOO_MANY_REQUESTS))
                .unwrap()
                .status,
            UpdateStatus::RateLimited
        );
        assert!(rate_limit(&response(StatusCode::FORBIDDEN)).is_none());
        let mut exhausted = response(StatusCode::FORBIDDEN);
        exhausted
            .headers
            .insert("x-ratelimit-remaining", "0".parse().unwrap());
        assert_eq!(
            rate_limit(&exhausted).unwrap().status,
            UpdateStatus::RateLimited
        );
        let serialized =
            serde_json::to_value(UpdateCheck::state(UpdateStatus::RateLimited, "Wait")).unwrap();
        assert_eq!(serialized["status"], "rate_limited");
        assert!(serialized.get("currentVersion").is_some());
        assert!(serialized.get("checkedAtUnix").is_some());
        assert!(serialized["latestVersion"].is_null());
    }

    #[test]
    fn missing_latest_is_unpublished_only_for_verified_public_repository() {
        let response = |status, body: &str| ApiResponse {
            status,
            headers: HeaderMap::new(),
            body: body.as_bytes().to_vec(),
        };
        assert_eq!(
            missing_release_result(
                &response(
                    StatusCode::OK,
                    r#"{"private":false,"full_name":"Chucksterboy/dino-lab"}"#
                ),
                &test_config()
            )
            .status,
            UpdateStatus::Unpublished
        );
        for metadata in [
            response(StatusCode::NOT_FOUND, r#"{"message":"Not Found"}"#),
            response(StatusCode::FORBIDDEN, r#"{"message":"Forbidden"}"#),
            response(
                StatusCode::OK,
                r#"{"private":true,"full_name":"Chucksterboy/dino-lab"}"#,
            ),
            response(
                StatusCode::OK,
                r#"{"private":false,"full_name":"other/repository"}"#,
            ),
            response(StatusCode::OK, "not JSON"),
        ] {
            assert_eq!(
                missing_release_result(&metadata, &test_config()).status,
                UpdateStatus::Unavailable
            );
        }
    }

    #[test]
    fn incomplete_or_non_windows_release_never_announces_an_update() {
        let original: serde_json::Value = serde_json::from_slice(&release("v0.2.0")).unwrap();
        for assets in [
            serde_json::json!([]),
            serde_json::json!([{"name":"app.zip","state":"uploaded","size":20,"browser_download_url":"https://github.com/Chucksterboy/dino-lab/releases/download/v0.2.0/app.zip"}]),
            serde_json::json!([{"name":"app.exe","state":"new","size":20,"browser_download_url":"https://github.com/Chucksterboy/dino-lab/releases/download/v0.2.0/app.exe"}]),
            serde_json::json!([{"name":"app.exe","state":"uploaded","size":0,"browser_download_url":"https://github.com/Chucksterboy/dino-lab/releases/download/v0.2.0/app.exe"}]),
            serde_json::json!([{"name":"app.exe","state":"uploaded","size":20,"browser_download_url":"https://evil.example/app.exe"}]),
            serde_json::json!([{"name":"app.exe","state":"uploaded","size":20,"browser_download_url":"https://github.com/other/repo/releases/download/v0.2.0/app.exe"}]),
        ] {
            let mut value = original.clone();
            value["assets"] = assets;
            assert_eq!(
                release_result(
                    &serde_json::to_vec(&value).unwrap(),
                    &test_config(),
                    "0.1.3"
                )
                .status,
                UpdateStatus::Unavailable
            );
        }
    }

    #[test]
    fn body_cap_and_server_retry_delays_are_enforced() {
        let mut body = vec![0; MAX_JSON_BYTES - 1];
        append_capped(&mut body, &[1]).unwrap();
        assert!(append_capped(&mut body, &[2]).is_err());
        assert_eq!(body.len(), MAX_JSON_BYTES);
        let mut headers = HeaderMap::new();
        headers.insert("retry-after", "30".parse().unwrap());
        assert_eq!(retry_delay(&headers, 1000), 30);
        headers.remove("retry-after");
        headers.insert("x-ratelimit-reset", "1120".parse().unwrap());
        assert_eq!(retry_delay(&headers, 1000), 120);
        headers.insert(
            "retry-after",
            "Thu, 01 Jan 1970 00:18:20 GMT".parse().unwrap(),
        );
        assert_eq!(retry_delay(&headers, 1000), 100);
    }

    #[test]
    #[ignore = "Makes an unauthenticated network read; run after release repository setup"]
    fn live_configured_repository_check() {
        let expected = std::env::var("DINO_LAB_EXPECTED_UPDATE_STATUS")
            .expect("Set DINO_LAB_EXPECTED_UPDATE_STATUS for the configured repository");
        let result = tauri::async_runtime::block_on(check_for_updates());
        let value = serde_json::to_value(result).unwrap();
        println!("{}", serde_json::to_string_pretty(&value).unwrap());
        assert_eq!(value["status"].as_str(), Some(expected.as_str()));
    }
}
