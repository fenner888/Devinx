# Devin Mobile Pet

Devin is a beaver/otter-style mobile builder companion for the DevinX app.

This package contains a real Codex-compatible animated sprite atlas, not just reference art.

## Files

- `pet.json` - character identity, atlas geometry, and asset paths.
- `states.json` - mobile state to atlas-row mappings.
- `events.json` - app/workflow event to pet-state mappings.
- `assets/sprites/devin-spritesheet.webp` - production-friendly animated atlas.
- `assets/sprites/devin-spritesheet.png` - PNG copy of the same atlas.
- `assets/frames/*` - extracted transparent frame PNGs, easiest for React Native animation.
- `qa/contact-sheet.png` - visual QA sheet for every row.
- `qa/videos/*.mp4` - one animation preview video per row.

## Atlas

- Format: 8 columns by 9 rows.
- Cell size: 192 x 208.
- Rows: `idle`, `running-right`, `running-left`, `waving`, `jumping`, `failed`, `waiting`, `running`, `review`.

## Recommended DevinX Use

Use Devin as an in-app React Native companion. iOS will not allow a third-party app to place a persistent pet overlay on top of other apps in an App Store-safe way, so the first integration should live inside DevinX screens, cards, and task/status surfaces.

Good first places:

- Home dashboard status card.
- Active task/session detail screen.
- Approval or delete confirmation panel.
- Waiting/background-sync UI.

## Current Status

Generated and validated:

- Seated laptop typing idle.
- Laptop walk cycles.
- Friendly wave.
- Small success bounce.
- Failed/blocked laptop reaction.
- Waiting and focused review loops.

Not integrated yet:

- React Native rendering component.
- DevinX event wiring.
- Any native widget or Live Activity surface.
