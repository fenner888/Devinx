# 032 — Destination-scoped Home Recent

Status: implemented, automated-test validated, and uploaded in iOS Build 35;
physical switching verification remains

## Intent

Home is a session-creation surface whose context is controlled by the active
destination selector. Its Recent list must follow that same context so newer
sessions from another origin cannot displace the sessions the user expects to
see.

## Behavior

- Devin Cloud selected: show only the five most recently updated Cloud
  sessions.
- Computer selected: show only the five most recently updated sessions from
  the selected paired computer.
- Switching destination updates Recent immediately from already validated
  query data; it does not trigger a connection-mode change or mix origins.
- Switching between multiple computers scopes Recent to the newly selected
  Mac.
- The full Sessions screen remains the combined cross-origin archive with
  explicit origins and search.
- Cloud-only and Computer-only modes retain their existing single-source
  behavior.

## Security and presentation

- No new endpoint, permission, persistence, or dependency is introduced.
- Computer rows retain their minimized, sanitized Connector presentation.
- Cloud and Computer query caches remain separate.
