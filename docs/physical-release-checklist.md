# Build 22 physical release checklist

Use a non-sensitive Devin session and prompts that contain no credentials, private repository content, or customer data. Capture only pass/fail evidence unless a screenshot is explicitly safe.

## Local steering and history

- Install internal TestFlight Build 22 and cold-launch DevinX.
- Open the paired computer session used for the prior steering check.
- Confirm prior user turns and Devin replies remain separate and in chronological order.
- Send `Reply with exactly: Build 22 local steering works.`
- Confirm the keyboard dismisses, the pending user bubble appears immediately, and `Devin is working…` is visible.
- Confirm Devin walks across the response-feed edge without sliding, snapping, or covering the composer.
- Confirm the exact reply appears once, renders normally, remains after pull-to-refresh, and Devin stops smoothly.
- Scroll upward before a refresh and confirm new content does not pull the reader away; return near the bottom and confirm new content follows automatically.

## Device authorization and removal

- Remove the Mac from DevinX on the iPhone and confirm session access disappears.
- Confirm the removed phone can no longer call health, list, load, or prompt on the Mac.
- Re-pair through a fresh QR and explicitly grant read and send permissions.
- Revoke the iPhone in DevinX Connector and confirm the phone loses access without revealing whether the resource still exists.
- Re-pair once more only if needed for the remaining mode tests.

## Connection modes

- Select Cloud only, force-quit, cold-launch, and confirm only cloud sessions appear.
- Select Computer only, force-quit, cold-launch, and confirm only paired-computer sessions appear.
- Select Cloud + Computer, force-quit, cold-launch, and confirm both origins appear with clear labels and no duplicate sessions.

## Appearance and accessibility

- Check the home, sessions list, local session, settings, and scanner in light and dark appearance.
- Enable Reduce Motion and confirm Devin remains stationary while status and working text still communicate progress.
- Enable VoiceOver and verify the back button, session rows, composer, send button, scanner, connection choices, and Devin status have useful labels and reading order.
- Test Larger Text/Dynamic Type and confirm critical controls remain visible without overlap or clipped meaning.
- Open the QR scanner and confirm the camera is immediately visible without scrolling, the frame is neither full-screen nor narrow, Cancel remains reachable, and denied permission routes safely to Settings.
