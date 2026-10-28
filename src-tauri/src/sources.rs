fn verified_source_url(input: &str) -> Result<url::Url, String> {
    let parsed = url::Url::parse(input).map_err(|_| "The source URL is invalid.".to_string())?;
    let trusted_host = matches!(
        parsed.host_str(),
        Some("theisle-speciesdatadashboard.pages.dev")
            | Some("docs.google.com")
            | Some("efg.io.vn")
            | Some("www.efg.io.vn")
    );
    if parsed.scheme() != "https"
        || !trusted_host
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.port().is_some_and(|port| port != 443)
    {
        return Err("Only Dino Lab's verified HTTPS source sites can be opened.".to_string());
    }
    Ok(parsed)
}

/// Opens a verified data or artwork source in the user's default browser.
#[tauri::command]
pub async fn open_source(url: String) -> Result<(), String> {
    let parsed = verified_source_url(&url)?;
    tauri::async_runtime::spawn_blocking(move || {
        open::that_detached(parsed.as_str())
            .map_err(|error| format!("Could not open the source: {error}"))
    })
    .await
    .map_err(|error| format!("Could not open the source: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_verified_https_sources() {
        for url in [
            "https://theisle-speciesdatadashboard.pages.dev/",
            "https://docs.google.com/spreadsheets/d/example/edit?usp=sharing",
            "https://efg.io.vn/species/allo",
        ] {
            assert!(verified_source_url(url).is_ok(), "{url}");
        }
    }

    #[test]
    fn rejects_external_hosts_credentials_and_other_protocols() {
        for url in [
            "https://docs.google.com.evil.example/",
            "https://docs.google.com@evil.example/",
            "https://user:secret@docs.google.com/",
            "http://docs.google.com/",
            "https://docs.google.com:8443/",
            "file:///C:/Windows/system32/cmd.exe",
            "javascript:alert(1)",
        ] {
            assert!(verified_source_url(url).is_err(), "{url}");
        }
    }
}
