# Minimize on close

Version 0.1.4 enables **Preferences → Minimize on close** by default. The setting is saved locally in the native desktop preferences.

The X button and Alt+F4 hide the window in the Windows system tray. Clicking the tray icon, choosing **Open Dino Lab**, or opening the desktop shortcut restores the same window and research session. **Exit Dino Lab** in the tray menu quits the app. Turning the preference off restores ordinary close-to-exit behavior.

If the tray icon is unavailable or hiding the window fails, closing exits normally. Saving a preference must finish before the app changes its close behavior.

## Manual verification

The user requested to perform the visual checks. No automated UI input or visible app launch was performed for this update.

1. Reopen the updated app from the desktop shortcut and confirm version 0.1.4.
2. Open a dinosaur, set a growth value, and close the window with X. Restore it from the tray and confirm the same page and growth remain.
3. Close with Alt+F4, then use the desktop shortcut to restore the same window.
4. Turn Minimize on close off in Preferences and close the window. Open it again and confirm the setting remains off.
5. Enable it again, close to the tray, then choose Exit Dino Lab to quit.

Automated checks cover preference reads/writes and failure handling, native persistence and close policy, plus the packaged asset diagnostic. They do not replace these Windows interaction checks.
