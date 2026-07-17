# 037 — Repository picker keyboard-safe search

Status: implemented and automated-test validated; physical-device verification remains

## Intent

Cloud repository search must remain usable while the iOS keyboard is visible. Opening
the keyboard must not collapse the picker into its drag handle or hide matching rows.

## Contract

- Search the complete, paginated Cloud repository result from spec 031.
- Match repository names and owner-qualified repository paths case-insensitively after
  trimming surrounding whitespace.
- Keep the search field, result count, and a scrollable result viewport visible above
  the software keyboard.
- Allow an interactive keyboard dismissal on iOS and an on-drag dismissal elsewhere.
- Preserve the existing explicit close, clear-search, Any repository, loading, retry,
  empty-result, and selection behaviors.
- Do not add a dependency or change repository authorization, pagination, or session
  creation API contracts.

## Acceptance checks

1. Searching `DevinX`, `devinx`, or `fenner888/Devinx` keeps the matching connected
   repository visible and selectable.
2. A missing query shows the no-match state without dismissing the picker.
3. Opening the keyboard does not reduce the picker to only its drag handle.
4. Dragging the results can dismiss the keyboard without dismissing the picker.
