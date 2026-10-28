<#
.SYNOPSIS
Validates Dino Lab release files; publishes only with the explicit -Publish switch.
.EXAMPLE
.\tools\publish-release.ps1 -Version 0.1.4 -Repository OWNER/REPO -NotesPath .\docs\release-notes-0.1.4.md
.EXAMPLE
.\tools\publish-release.ps1 -Version 0.1.4 -Repository OWNER/REPO -NotesPath .\docs\release-notes-0.1.4.md -Publish
.NOTES
Default mode performs local reads only. No commits, pushes, visibility changes,
repository creation, automatic installation or release replacement are performed.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$')]
    [string] $Version,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9][A-Za-z0-9._-]*$')]
    [string] $Repository,

    [Parameter(Mandatory = $true)]
    [string] $NotesPath,

    [string] $ExecutablePath,
    [string] $SetupPath,

    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._/-]*$')]
    [string] $Target = 'main',

    [switch] $Publish
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$dinoProjectRoot = Split-Path -Parent $PSScriptRoot
$dinoTag = "v$Version"
if (-not $ExecutablePath) { $ExecutablePath = Join-Path $dinoProjectRoot 'release\Dino Lab.exe' }
if (-not $SetupPath) { $SetupPath = Join-Path $dinoProjectRoot 'release\Dino Lab Setup.exe' }

function Resolve-DinoFile([string] $PathValue) {
    $resolved = (Resolve-Path -LiteralPath $PathValue -ErrorAction Stop).ProviderPath
    $file = Get-Item -LiteralPath $resolved
    if ($file.PSIsContainer -or $file.Length -eq 0) { throw "Expected a nonempty file: $resolved" }
    return $file
}

function Test-DinoExecutable([System.IO.FileInfo] $File) {
    if ($File.Extension -ine '.exe' -or $File.Name.Contains('#')) { throw "Expected an .exe asset without # in its filename: $($File.Name)" }
    $reader = [System.IO.BinaryReader]::new([System.IO.File]::OpenRead($File.FullName))
    try {
        if ($reader.BaseStream.Length -lt 64 -or $reader.ReadUInt16() -ne 0x5A4D) { throw "Missing Windows MZ header: $($File.Name)" }
        [void] $reader.BaseStream.Seek(0x3C, [System.IO.SeekOrigin]::Begin)
        $peOffset = $reader.ReadUInt32()
        if ($peOffset -gt ($reader.BaseStream.Length - 4)) { throw "Invalid PE header offset: $($File.Name)" }
        [void] $reader.BaseStream.Seek($peOffset, [System.IO.SeekOrigin]::Begin)
        if ($reader.ReadUInt32() -ne 0x00004550) { throw "Missing Windows PE signature: $($File.Name)" }
    }
    finally { $reader.Dispose() }
    $info = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($File.FullName)
    $expected = '^' + [regex]::Escape($Version) + '(?:\.0)?$'
    foreach ($entry in @(@('ProductVersion', $info.ProductVersion), @('FileVersion', $info.FileVersion))) {
        if (-not $entry[1] -or $entry[1].Trim() -notmatch $expected) {
            throw "$($File.Name) $($entry[0]) '$($entry[1])' does not match $Version. Rebuild this version before publishing."
        }
    }
    return [pscustomobject]@{
        File = $File
        ProductVersion = $info.ProductVersion
        FileVersion = $info.FileVersion
        Sha256 = (Get-FileHash -LiteralPath $File.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}

function Invoke-DinoGhJson([string[]] $Arguments) {
    $json = & gh @Arguments
    if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI read failed. Check authentication, repository access and connectivity.' }
    return (($json -join "`n") | ConvertFrom-Json)
}

$dinoPackage = Get-Content -LiteralPath (Join-Path $dinoProjectRoot 'package.json') -Raw | ConvertFrom-Json
$dinoTauri = Get-Content -LiteralPath (Join-Path $dinoProjectRoot 'src-tauri\tauri.conf.json') -Raw | ConvertFrom-Json
$dinoCargo = Get-Content -LiteralPath (Join-Path $dinoProjectRoot 'src-tauri\Cargo.toml') -Raw
$dinoPackageSection = [regex]::Match($dinoCargo, '(?ms)^\[package\]\s*(.*?)(?=^\[|\z)').Groups[1].Value
$dinoCargoVersion = [regex]::Match($dinoPackageSection, '(?m)^version\s*=\s*"([^"]+)"').Groups[1].Value
foreach ($entry in @(@('package.json', $dinoPackage.version), @('tauri.conf.json', $dinoTauri.version), @('Cargo.toml', $dinoCargoVersion))) {
    if ($entry[1] -cne $Version) { throw "$($entry[0]) version '$($entry[1])' does not match $Version." }
}

$dinoNotes = Resolve-DinoFile $NotesPath
if ([string]::IsNullOrWhiteSpace((Get-Content -LiteralPath $dinoNotes.FullName -Raw))) { throw 'Release notes must describe the actual changes.' }
$dinoAssets = @(Test-DinoExecutable (Resolve-DinoFile $ExecutablePath); Test-DinoExecutable (Resolve-DinoFile $SetupPath))
if ($dinoAssets[0].File.FullName -ieq $dinoAssets[1].File.FullName -or $dinoAssets[0].File.Name -ieq $dinoAssets[1].File.Name) { throw 'Choose two distinct executable and installer assets.' }

Write-Output "Release plan: https://github.com/$Repository/releases/tag/$dinoTag"
Write-Output "Stable version: $Version; tag target: $Target; notes: $($dinoNotes.FullName)"
foreach ($asset in $dinoAssets) { Write-Output "$($asset.File.Name) | $($asset.File.Length) bytes | product $($asset.ProductVersion) | SHA256 $($asset.Sha256)" }
if (-not $Publish -or $WhatIfPreference) {
    Write-Output 'DRY RUN: local validation passed. No GitHub requests or writes were made. Add -Publish only after reviewing the release destination and files.'
    return
}

[void] (Get-Command gh -ErrorAction Stop)
$dinoRepo = Invoke-DinoGhJson -Arguments @('repo', 'view', $Repository, '--json', 'nameWithOwner,isPrivate,isEmpty')
if ($dinoRepo.nameWithOwner -ine $Repository) { throw 'The resolved GitHub repository does not match the requested destination.' }
if ($dinoRepo.isPrivate) { throw 'The anonymous app checker needs a public release repository. Choose the agreed public destination; this script never changes visibility.' }
if ($dinoRepo.isEmpty) { throw 'The release repository needs an initial commit, such as a public README, before its version tag can be created.' }
$dinoExisting = @(Invoke-DinoGhJson -Arguments @('release', 'list', '--repo', $Repository, '--limit', '1000', '--json', 'tagName,isDraft,isPrerelease'))
foreach ($release in $dinoExisting) {
    if ($release.tagName -ceq $dinoTag) { throw "Release $dinoTag already exists. This helper never overwrites an existing draft or published release." }
    if (-not $release.isDraft -and -not $release.isPrerelease -and $release.tagName -match '^v?((0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*))$') {
        if ([version] $Matches[1] -ge [version] $Version) { throw "Stable release $($release.tagName) is already at or above $dinoTag. Choose a new higher version." }
    }
}

if (-not $PSCmdlet.ShouldProcess("https://github.com/$Repository", "Upload both assets and publish stable release $dinoTag as Latest")) { return }
try {
    $dinoCreateArguments = @('release', 'create', $dinoTag, '--repo', $Repository, '--target', $Target, '--title', "Dino Lab $dinoTag", '--notes-file', $dinoNotes.FullName, '--draft', $dinoAssets[0].File.FullName, $dinoAssets[1].File.FullName)
    & gh @dinoCreateArguments
    if ($LASTEXITCODE -ne 0) { throw 'Release draft creation or asset upload failed.' }
    $dinoDraft = Invoke-DinoGhJson -Arguments @('api', "repos/$Repository/releases/tags/$dinoTag")
    if (-not $dinoDraft.draft -or $dinoDraft.prerelease) { throw 'Expected an unpublished stable draft before final publication.' }
    foreach ($asset in $dinoAssets) {
        $remoteAssets = @($dinoDraft.assets | Where-Object { $_.name -ceq $asset.File.Name })
        if ($remoteAssets.Count -ne 1 -or $remoteAssets[0].state -ne 'uploaded' -or $remoteAssets[0].size -ne $asset.File.Length) { throw "Uploaded asset verification failed: $($asset.File.Name)" }
        $digestProperty = $remoteAssets[0].PSObject.Properties['digest']
        if ($digestProperty -and $digestProperty.Value -and $digestProperty.Value -ine "sha256:$($asset.Sha256)") { throw "Uploaded asset digest mismatch: $($asset.File.Name)" }
    }
    & gh release edit $dinoTag --repo $Repository --draft=false --prerelease=false --latest
    if ($LASTEXITCODE -ne 0) { throw 'Final release publication failed.' }
    $dinoLatest = Invoke-DinoGhJson -Arguments @('api', "repos/$Repository/releases/latest")
    if ($dinoLatest.tag_name -cne $dinoTag -or $dinoLatest.draft -or $dinoLatest.prerelease -or -not $dinoLatest.published_at) { throw 'The release was published, but the Latest feed did not return the expected stable version. Inspect the repository before retrying.' }
    Write-Output "Published and verified: $($dinoLatest.html_url)"
}
catch {
    Write-Warning 'Inspect GitHub Releases before retrying. A draft or published release may remain; no automatic deletion or overwrite was attempted.'
    throw
}
