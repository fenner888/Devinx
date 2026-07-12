# 028 — Session composer layout

Status: implemented, automated-test validated, and uploaded in iOS Build 30;
physical layout and keyboard verification remain

## Intent

The Home composer starts a new session and may expose destination, model, mode,
playbook, repository, and attachment controls. Existing Cloud and Computer
sessions are follow-up conversations, so their composers stay simpler while
sharing the same visual language.

## Home composer

- Keep the existing single-surface structure and existing controls.
- The empty prompt area must be compact and responsive. It must not reserve a
  large blank block above the controls before the user types.
- The prompt grows for multiline content up to its existing bounded height.

## Existing-session composers

- Cloud and Computer session composers use an elevated `surface1` composer with
  the same radius, border, prompt spacing, and send-button placement.
- The composer supports a comfortable two-to-three-line draft and grows only to
  a bounded maximum height.
- The prompt occupies the upper portion of the surface. Existing actions occupy
  a short footer: Cloud retains its attachment action; Computer remains
  text-only. Do not invent model, reasoning, or attachment controls for a
  transport that does not support them.
- The surface has horizontal margins and visible breathing room above the iOS
  home indicator. Do not place it inside a contrasting full-width shelf or pin
  its border directly to the bottom edge.
- Sleeping, upload, and failure notices remain immediately above or below the
  composer without covering it.
- Keyboard avoidance, keyboard dismissal on send, draft preservation, reduced
  motion, and the response-feed companion behavior remain unchanged.

## Tokens and accessibility

- Use semantic theme tokens only; no raw component colors.
- Preserve multiline input semantics and explicit accessibility labels for the
  prompt and send actions.
- Keep a fixed minimum composer footprint so placeholder, draft, and sending
  states do not cause layout shifts.
