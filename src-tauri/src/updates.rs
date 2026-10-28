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
    result.release_name = release
        .name
        .filter(|value| !value.trim().is_empty())
        .map(|value| value.chars().take(200).collect());
    result.published_at = release.published_at;
    result
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
