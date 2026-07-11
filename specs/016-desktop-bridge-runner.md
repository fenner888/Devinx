# 016 — Desktop Bridge development runner

Status: implemented and automated-test validated as a historical development runner. Specs 020 and 021 supersede its Wi-Fi/TLS setup with the packaged, Tailscale-only Connector, which has passed real Mac-to-iPhone pairing.

## Scope

This phase provides the first locally runnable macOS bridge checkpoint. It is a development runner, not the final signed/notarized desktop distribution. It composes the already implemented Keychain state, TLS listener, pairing manager, authenticated dispatcher, and optional Devin ACP adapter without changing Cloud credentials or the mobile Devin companion.

The runner:

- requires an explicit active private IPv4 address from the Mac instead of guessing between Wi-Fi, VPN, and link-local interfaces;
- binds the listener to local interfaces while accepting only private peers and the explicit advertised `Host` value;
- loads or creates the bridge identity and TLS certificate in macOS Keychain;
- displays the one-time pairing payload only as a local terminal QR code;
- never writes the QR payload, pairing secret, or poll token to disk, logs, command-line arguments, environment variables, or analytics;
- shows a sanitized device name and requires the desktop user to type `yes` before registration;
- has no network approval route and keeps denial local;
- enables only pairing and authenticated bridge health by default;
- starts read-only Devin ACP session discovery only when the user explicitly supplies `--devin-cli` with an absolute path; and
- closes the HTTPS listener and ACP child, clears replay/runtime state, and destroys the in-memory session-handle key on shutdown or partial startup failure.

No Cloud API key, token, org ID, or attribution ID is read by this process.

## Usage

List the active private addresses first:

```bash
npm run bridge:start -- --help
```

Start the pairing-only checkpoint using the Mac's Wi-Fi address:

```bash
npm run bridge:start -- --host 192.168.1.141
```

Read-only ACP session discovery can be enabled later with an explicitly selected executable:

```bash
npm run bridge:start -- --host 192.168.1.141 --devin-cli /absolute/path/to/devin
```

The CLI accepts no credential or secret options. A public, loopback, inactive, malformed, or non-IPv4 advertised address fails closed. Ports below 1024 are rejected.

## Dependency gate

`qrcode-terminal` is pinned directly at `0.12.0` for local, offline terminal rendering. Before installation it was verified against the npm registry and its public GitHub repository: the package has a long publish history, a real repository and maintainers, no runtime dependencies, and approximately 31.7 million npm downloads in the checked 30-day window. It was already present transitively through Expo CLI at `0.11.0`; pinning the verified direct version makes the production runner dependency explicit. The post-install audit remains at zero high or critical findings.

## Automated validation

Runner tests cover:

- private-interface discovery and exact host matching;
- strict argument parsing with no secret option;
- terminal control and bidirectional-character neutralization;
- TLS-bound QR creation without persistence of its one-time secret;
- opt-in-only ACP startup; and
- listener and ACP cleanup after a partial startup failure.

This terminal runner is retained for protocol development and automated coverage, not user onboarding. Release validation uses the packaged Connector and must revalidate camera handling, pending approval, denial, approval receipt, Keychain persistence, revocation, and clean reconnect through Tailscale.
