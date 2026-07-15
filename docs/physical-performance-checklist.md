# Physical performance and stability checklist

Use the exact final TestFlight candidate on the oldest supported physical iPhone available. Do not use production/customer sessions or credentials in screenshots, recordings, Instruments traces, or logs.

The current target is DevinX `0.1.0 (64)`. If a source change requires a later build, replace this
target and repeat every affected measurement rather than carrying Build 64 evidence forward.

## Cold launch

- Force-quit the app, wait 10 seconds, and launch it five times in each configured connection mode.
- Measure from icon tap until the cached session board or intentional empty/loading state is usable.
- Record median and worst time, device model, iOS version, app build, connection mode, and whether caches were warm or cold.
- Target: median under 2 seconds to a cached board. Record a failure rather than excluding an outlier without explanation.

## Session-list scrolling

- Use sanitized fixtures or a non-sensitive account with at least 200 session rows.
- Record a release-mode scroll with Xcode Instruments/Core Animation or another reproducible frame metric.
- Scroll continuously for 30 seconds in both directions, search, open a row, return, and repeat in light and dark appearance.
- Target: no visible stalls and sustained 60 fps on a 60 Hz device; retain the metric summary, not private screen content.

## Foreground battery

- Charge above 80%, disable Low Power Mode, record battery level and thermal state, and keep the screen at a fixed brightness.
- Run Balanced polling in the foreground for one hour without active session creation or unrelated apps.
- Record start/end battery, thermal warnings, network type, number of cloud/local sessions, and whether a session was actively running.
- Target: under 2 percentage points per hour attributable to DevinX. Repeat if OS background work or thermal throttling invalidates the run.

## Stability window

- Use an internal/external TestFlight group for at least seven days before App Store submission.
- Review organizer crash/energy metrics and any tester reports against the exact build.
- Target: greater than 99.5% crash-free sessions, with every privacy, authorization, or data-loss report treated as release-blocking regardless of the aggregate rate.

## Evidence record

Record results in `docs/release-readiness.md` or a dated private release record. Do not commit credentials, session content, repository names, device identifiers, IP addresses, QR payloads, or full Instruments traces containing user data.
