# Dino Lab 0.1.11

- Added **Update now** to available-update notices and the bottom-left Updates panel.
- Added installer download and verification progress, with retry after preparation errors.
- Dino Lab exits completely after a verified installer is ready; a separate helper waits for the app to exit before opening Windows setup.
- Update checks alone never download or launch installers. Close-to-tray remains available for normal window closing.

Versions through 0.1.10 need this version installed once from GitHub; future releases can use Update now. Portable users open the normal Windows installer. Gallimimus speed data is unchanged.

## Windows downloads

- **Dino-Lab-0.1.11-Windows-Setup.exe** — Windows installer.
- **Dino-Lab-0.1.11-Windows-Portable.exe** — standalone application.

Validation: 117 app tests, 28 native tests, a read-only live update-feed check and all 33 embedded-asset checks passed.
