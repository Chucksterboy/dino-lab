$ErrorActionPreference = 'Stop'
$dinoProjectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $dinoProjectRoot
try {
    & npm.cmd run tauri -- build --features custom-protocol
    if ($LASTEXITCODE -ne 0) { throw 'Dino Lab desktop build failed.' }
}
finally { Pop-Location }
