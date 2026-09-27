# Connector update guidance

Explain the separate iPhone and local Connector update paths without implying
that a mobile update installs desktop software or that every version check is
live release discovery.

- Keep update help and official Mac/Windows links visible on the paired Local
  device screen, including when version discovery fails or is compatible.
- Preserve the minimum-version warning; do not mark an offline device outdated
  or change compatibility, pairing, permissions or networking.
- Explain Mac installation: download the official DMG on the Mac, quit Connector
  from its menu-bar menu, replace the Applications copy, then reopen. Explain
  that pairing is retained and closing the window does not quit Connector.
- Explain Windows updates through Microsoft Store on the PC, then reopen.
- The Mac release banner must say installation is manual and use a clear
  download action. No auto-updater or installer behavior is added.
- Always show Check for updates in Mac Connector, disable duplicate in-flight
  checks, bypass cached release responses, and show success/failure feedback.
  Preserve official-release URL and response validation.
- Test rendering and links for legacy, compatible and unavailable Connectors,
  native copy and Swift compilation. Visual parity and new binaries remain
  release gates; existing published binaries are unchanged.

## Implementation checkpoint

Implemented in the paired Local device screen, assisted setup prompt, and Mac
update banner. No networking, credentials, grant, compatibility or updater
behavior changed. 24 targeted tests pass, TypeScript and ESLint pass, and the
Mac Swift source typechecks for Apple Silicon. New iOS/Mac builds, visual parity
and distribution are not completed by this source-only change.
