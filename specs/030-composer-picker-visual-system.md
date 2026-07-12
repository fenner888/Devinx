# 030 — Composer picker visual system

Status: implementation in progress; physical verification required in the next
TestFlight checkpoint

## Intent

The Home composer destination, workspace, repository, model-family, and
reasoning/speed pickers must feel like one product. Picker presentation may
vary between a bottom sheet and compact centered menu, but row hierarchy,
selection, spacing, and dismissal remain consistent.

## Bottom-sheet structure

- Destination and workspace use content-sized bottom sheets with a subtle drag
  handle, title, concise supporting copy, and explicit close action.
- Options live in one grouped `surface1` container. Do not render each option as
  a separate floating card.
- Rows are flat, touch-safe, and separated by subtle hairlines. Selection uses
  a restrained tinted row plus a simple checkmark.
- Icons use a compact secondary container. Descriptions explain meaningful
  differences without repeating the title.
- Sheets have a bounded maximum height and scroll only when their contents
  require it. They must not reserve a large empty panel below a short list.

## Functional boundaries

- Destination selection continues to distinguish Devin Cloud from each paired
  computer and resets incompatible Computer workspace/model state when the Mac
  changes.
- Workspace choices remain the sanitized, opaque-handle-backed set returned by
  the paired Connector. The phone never receives or displays raw paths.
- Repository, model, and reasoning behavior remain unchanged by this visual
  pass.

## Accessibility and tokens

- Use semantic theme tokens only.
- Preserve modal dismissal, explicit accessible names, 44-point-equivalent
  touch targets, selected-state semantics, and keyboard-safe scrolling.
