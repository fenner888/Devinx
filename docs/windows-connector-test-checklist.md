# DevinX Connector for Windows — physical test checklist

Status: required acceptance evidence for the Windows 11 x64 public test track.

## Use only the verified Store package

Install [DevinX Connector from Microsoft Store](https://apps.microsoft.com/detail/9N52Z3FVMFH8).
Confirm all of the following before pairing:

- product name: **DevinX Connector**
- publisher: **DevinX Tools**
- Store ID: `9N52Z3FVMFH8`
- version: `0.1.2.0` or newer
- device: Windows 11 x64, build `10.0.22000` or newer

Do not download, sideload, or run an unsigned MSIX, EXE, or ZIP from GitHub Actions. Never share a
pairing QR, device credential, Devin credential, Tailscale key, or unredacted diagnostic bundle.

## Prerequisites

- Install and authenticate the official **Devin for Terminal** CLI.
- Confirm `devin --version` works in a normal, non-administrator terminal for the signed-in user.
- Install Tailscale on the Windows PC and iPhone, sign both into the same tailnet, and leave
  Tailscale connected.
- Install the current DevinX TestFlight build on the iPhone.

Record the Windows build, Connector version, Devin CLI version, and iPhone build before testing.

## Required acceptance matrix

### 1. Install and first launch

- Install from Microsoft Store as a standard user without running as Administrator.
- Open Connector and confirm it detects both Tailscale and Devin for Terminal.
- Confirm the window shows a short-lived pairing code without exposing credentials.
- Close the window and confirm Connector remains available from the notification-area icon.
- Choose **Quit DevinX Connector** and confirm the listener stops.

### 2. Pairing and permission separation

- Reopen Connector and generate a fresh code.
- In DevinX, open **Settings → Local devices → Add local device** and scan the code.
- Deny one pairing request and confirm the phone receives a recoverable failure.
- Generate a new code, approve the named iPhone, and grant read access only.
- Confirm session titles/history load but sending and creating remain unavailable.
- Add steering and session-creation grants separately; confirm each capability appears only after
  its grant is approved.
- Let one unused code expire and confirm it cannot be replayed.

### 3. Sessions and interactive work

- Load the local session list and open an existing session with history.
- Create a new local session in an approved workspace.
- Send a steering message and confirm exactly one response appears.
- Trigger an `AskUserQuestion` request, answer it on the iPhone, and confirm the local session
  continues.
- Change or refresh the model catalog and confirm a failed refresh preserves the prior valid list.
- Lock a session from another client and confirm DevinX reports a recoverable in-use state rather
  than duplicating work.

### 4. Connectivity and recovery

- Put the PC to sleep, wake it, and confirm the same paired iPhone reconnects.
- Disconnect and reconnect Tailscale; confirm Connector never falls back to Wi-Fi, LAN, a wildcard
  interface, or a public listener.
- Change the PC's Tailscale address if practical, rescan a fresh code, and confirm the existing
  device record refreshes instead of duplicating.
- Disconnect from the iPhone while Connector is running, then pair again.
- Revoke the iPhone from Connector and confirm further protected requests return a generic failure
  without revealing session existence.
- Confirm the most recently paired device appears first.

### 5. Startup, update, and removal

- Enable **Launch at sign-in**, sign out or reboot, and confirm Connector starts for that user.
- Disable launch at sign-in in Connector and confirm the setting remains off after reboot.
- If Microsoft Store offers an update, install it and confirm pairing and grants remain intact.
- Test **Repair** from Windows settings if available.
- Uninstall Connector and confirm only Connector files/state are removed; Devin CLI and Tailscale
  remain installed.
- Reinstall from Microsoft Store and confirm a fresh QR pairing is required after a full reset.
- Sign into a second Windows user and confirm the first user's Connector identity and grants are
  unavailable.

## Report

Report pass/fail for each numbered section. For any failure, include:

- the numbered step
- Windows build, Connector version, Devin CLI version, and iPhone build
- the exact visible error text
- a screenshot with QR codes, credentials, account identifiers, repository names, and private
  session content redacted
- whether retrying, reopening Connector, or reconnecting Tailscale changed the result

Passing automated CI and Microsoft Store certification does not replace this physical matrix.
