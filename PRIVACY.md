# Otterin Privacy Policy

Effective: July 11, 2026

Otterin is an independent, unofficial companion app for Devin for Terminal. Not affiliated with, endorsed by, or a product of Cognition AI.

## Data processed

After you pair and approve an iPhone, Otterin can request minimized Devin session metadata directly from your Mac over Tailscale. Message text requires a separate read grant. Local files, tool payloads, private thoughts, and Devin credentials are not returned by the Connector. Prompts are sent only to the paired computer when you choose to send them.

When you use dictation, microphone audio is transcribed on the iPhone and is never uploaded. The resulting transcript becomes ordinary editable composer text and is sent only if you choose to send the prompt or message. Scribe uses Apple Intelligence on-device when available, with a deterministic on-device template fallback.

Otterin stores paired-device keys in the system Keychain. App preferences, compose drafts, session context, and the local session read cache stay on this device. Otterin does not store Devin sign-in credentials.

Wiping local data removes paired-Mac keys and cached session data from this iPhone. Local-session responses may be held in memory and in the local session cache. The independently stored appearance choice may remain.

## Analytics, crash reports, and notifications

Otterin does not currently enable a product analytics SDK. Session titles, prompts, messages, repository names, source code, and attachments are not sent to an analytics provider.

The current release does not bundle or configure a crash-reporting SDK, so crash reports are not transmitted. If crash reporting is enabled in a future release, Otterin will update this policy and its App Store privacy disclosures before release.

The current release does not register the iPhone for remote push notifications and does not transmit an Expo push token.

## Paired-computer access

When you explicitly pair a computer, Otterin can connect directly to Otterin Connector running on a computer you control. Pairing requires a short-lived QR code, explicit approval on the computer, and a unique iPhone signing key. Subsequent requests are signed, authenticated, replay-protected, rate-limited, input-validated, and authorized by the computer.

The default grant exposes minimized session metadata. Separate per-device permissions can allow bounded user/Devin message history, sending text to a previously discovered session, and creating a session from a Connector-issued opaque workspace handle with an approved live model. Reading, sending, and creating are independent and can be removed separately. The Connector does not return raw local session identifiers, full filesystem paths, other directories, agent thoughts, tool inputs or outputs, commands, local files, API credentials, or unknown ACP metadata.

## Tailscale transport

Tailscale provides private network reachability between your iPhone and computer. Session traffic travels between those devices, not through an Otterin-operated relay. Use of Tailscale is governed by Tailscale's privacy policy and your account settings.

## App delivery

The installed app may contact Expo over encrypted TLS to check for a compatible Otterin update. Expo states that EAS Update requests may include the device operating system, the Expo project ID, normal network metadata, and a randomized token used to determine whether an app installation requested an update. Update requests do not include prompts, messages, repository names, local-session content, or Connector pairing secrets. Expo's handling of update-service transport data is governed by its privacy terms.

## Your controls and deletion

Disconnecting a computer from Otterin removes its pairing key from the iPhone. Wipe all local data to clear cached session data as well. You can revoke an iPhone from Otterin Connector to end that device's access to the Mac. Removing local Otterin data does not delete sessions or account data stored on your Mac.

Camera access is requested only when you choose to scan a Connector QR code. You can deny or later revoke that permission in iOS Settings. Otterin does not capture a photo or video while scanning a Connector QR code.

## Data sharing and sale

Otterin does not sell personal data, use data for advertising, or track users across other companies' apps and websites. Session traffic goes directly between an explicitly paired computer and the iPhone; Tailscale supplies private-network transport, and Expo may receive app-update request data as described above.

## Contact

For support or privacy questions, open an issue at `https://github.com/fenner888/Otterin/issues`.
