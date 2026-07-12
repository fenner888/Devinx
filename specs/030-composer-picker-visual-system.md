# 030 — Composer picker visual system

Status: implemented, automated-test validated, and uploaded in iOS Build 33 as
the UI-freeze checkpoint; physical visual and interaction verification remain

## Intent

The Home composer destination, workspace, repository, model-family, and
reasoning/speed pickers must feel like one product. Picker presentation may
vary between a bottom sheet and compact centered menu, but row hierarchy,
selection, spacing, and dismissal remain consistent.

## Bottom-sheet structure

- Destination uses a content-sized bottom sheet with a subtle drag handle,
  title, concise supporting copy, and explicit close action. Its options live
  in one grouped `surface1` container with flat separated rows.
- Workspace uses a horizontally inset floating sheet with rounded corners, a
  subtle drag handle, centered title, and explicit Done action. It groups the
  committed selection under Current Workspace and the remaining sanitized
  choices under Other Workspaces.
- Workspace choices use compact rounded surface rows with a simple check-circle
  selection affordance. Choosing a row updates a draft selection; Done commits
  it. Dismissing the sheet does not change the committed workspace.
- Workspace search is shown only when the approved list is long enough to
  benefit from filtering. It searches sanitized display names only.
- Rows are touch-safe. Selection uses a restrained tinted row plus a simple
  checkmark or check-circle.
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
- The workspace sheet may show the paired computer's sanitized display name as
  secondary context. It never accepts arbitrary filesystem-path input.
- Repository, model, and reasoning behavior remain unchanged by this visual
  pass.

## Accessibility and tokens

- Use semantic theme tokens only.
- Preserve modal dismissal, explicit accessible names, 44-point-equivalent
  touch targets, selected-state semantics, and keyboard-safe scrolling.
