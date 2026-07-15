# 015 — Native QR pairing UI

Status: implemented and native-build validated; real camera and full Mac approval test pending

## Camera boundary

The local Expo module owns an AVFoundation preview view; no camera or QR package was added. Camera access is requested only after the user taps **Scan pairing code**. Denied/restricted permission routes to iPhone Settings, while an unavailable camera or invalid code returns a small allowlisted error code without native error details.

The scanner:

- uses the back wide-angle camera and QR metadata only;
- never captures or stores a photo or video;
- limits decoded UTF-8 payloads to 4 KiB;
- delivers one result per activation and stops the capture session before dispatching it to JavaScript;
- stops when cancelled, backgrounded, removed from the window, or deallocated; and
- resets result delivery only after the React view explicitly deactivates it.

The iOS manifest contains purpose-specific Camera and Local Network usage descriptions. Android remains outside this native scanner phase.

## React Native flow

The existing Computer Connection screen now collects a user-facing Mac name before scanning, requests permission, embeds the camera inside the app, and passes the one-time payload directly into the secure pairing coordinator. It keeps only presentation status in React state; the payload is not stored in global state, navigation parameters, AsyncStorage, Secure Store, analytics, or logs.

While the phone waits, the UI tells the user to approve on the Mac and supports cancellation. A successful pairing refreshes sanitized computer summaries and enters the main app. Cloud-only users who pair from Settings move to Cloud + Computer mode. Configured users use a main-stack route, avoiding the root onboarding redirect.

Automated component tests cover first-use permission, scanner presentation, direct payload handoff, successful refresh/navigation, and denied permission. The Swift module and complete app still require a real iPhone camera test after the desktop runner can display and approve a real offer.
