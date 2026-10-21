# App Store screenshots in the iOS Simulator

This development-only mode loads fictional Local data into Otterin's real screens. It does not
connect to a Mac or change TestFlight and production builds.

On a Mac with Xcode and the iOS Simulator installed:

```sh
npm ci
npm run screenshots:ios -- --device "iPhone 17 Pro Max"
xcrun simctl status_bar booted override --time 9:41 --dataNetwork wifi --wifiBars 3 --cellularBars 4 --batteryState charged --batteryLevel 100
xcrun simctl ui booted appearance dark
xcrun simctl io booted screenshot home.png
```

The app opens directly on Home with the fictional Studio Mac, workspaces, model catalog, and recent
sessions. Use the menu button in the upper-left to navigate:

- **Home:** open the app or choose **New session**.
- **Working session:** scroll to Home's **Recent local sessions** and open **Add hourly forecast
  chart**, or open it from Sessions, to show its message history and activity timeline.
- **Sessions:** open the menu and choose **Sessions**.
- **Question:** from Sessions, open **Fix login redirect loop**.
- **Permission:** from Sessions, open **Write tests for recipe search**.
- **Your Mac:** open the menu and choose **Your Mac**.

Capture each screen with:

```sh
xcrun simctl io booted screenshot <file>.png
```

Change the output filename for each screen. All fixture workspaces, sessions, messages, and device
details are fictional; no QR scan, pairing, live network, or Keychain setup is needed.
