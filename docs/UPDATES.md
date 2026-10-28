# Dino Lab release notifications

Dino Lab checks a GitHub Releases feed for a newer stable app version. The notice opens the release page; it does not install anything or replace local files.

## What makes an update visible

Publish a **stable GitHub Release** tagged `vMAJOR.MINOR.PATCH`, such as `v0.1.4`, attach the matching Windows executable and installer, and mark the release **Latest**. The checker compares the numeric version to the installed app, so `0.1.10` is newer than `0.1.9`.

Uploading files to the repository, pushing commits, or creating a plain Git tag does not publish an app update. Drafts and prereleases do not enter the stable feed. GitHub’s latest-release endpoint returns a published full release; its ordering is not a substitute for comparing versions. See [GitHub’s latest-release API](https://docs.github.com/en/rest/releases/releases#get-the-latest-release).

## Configured release destination

The user selected the existing repository, **[Chucksterboy/dino-lab](https://github.com/Chucksterboy/dino-lab)**, as the public source and release destination. Its visibility was changed to public on 28 October 2026. The app targets this owner and repository in `src-tauri/update-config.json`, so the visibility change requires no rebuild.

Anonymous checks require public release metadata. No token belongs in the distributed app. An anonymous `404` cannot establish that the app is current. Public-resource access is supported without authentication by the [GitHub API](https://docs.github.com/en/rest/releases/releases#get-the-latest-release).

Project source is published on `main`, and Windows downloads are attached to stable versioned Releases. The publishing helper stages and verifies both binaries before marking a release Latest; it never creates repositories, changes visibility, commits or pushes source.

## Publish a stable version

1. Set the same new version in `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`. Rebuild and test both Windows files.
2. Write release notes describing the actual changes. Each release needs a new version; do not replace an already published version’s assets.
3. Run the local preview below for the configured public repository.

```powershell
$releaseRepo = 'Chucksterboy/dino-lab'
.\tools\publish-release.ps1 -Version '0.1.10' -Repository $releaseRepo `
  -NotesPath '.\docs\release-notes-0.1.10.md' `
  -ExecutablePath '.\release\Dino-Lab-0.1.10-Windows-Portable.exe' `
  -SetupPath '.\release\Dino-Lab-0.1.10-Windows-Setup.exe'
```

The default is a dry run with **no GitHub requests or writes**. It checks the three project versions, both files’ PE signatures and embedded product/file versions, and prints SHA-256 hashes. Its default files are `release\Dino Lab.exe` and `release\Dino Lab Setup.exe`.

After reviewing the files and notes, rerun the same command with `-Publish`. The helper verifies the public repository, stages a draft with both assets, checks uploaded names/sizes/hashes where GitHub supplies digests, then publishes it as Latest. This uses the official [release creation](https://cli.github.com/manual/gh_release_create) and [release editing](https://cli.github.com/manual/gh_release_edit) commands. If an upload fails, inspect any remaining draft before retrying; the helper does not delete or overwrite releases.

Test the notice using a genuinely older installed build and the real published release. An equal or newer installed version should stay quiet. Offline errors, rate limits and missing feeds must be shown as an unavailable check, not as confirmation that the app is current. The app remains usable without a connection.
