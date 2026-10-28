$ErrorActionPreference = 'Stop'
$dinoProjectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $dinoProjectRoot
try {
    & npm.cmd run tauri -- dev
    if ($LASTEXITCODE -ne 0) { throw 'Dino Lab desktop development process failed.' }
}
finally { Pop-Location }
