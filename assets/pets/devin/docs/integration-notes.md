# DevinX Integration Notes

DevinX is an Expo React Native app, so the safest first integration is a reusable React Native companion component that reads the generated `states.json` contract and crops frames from `assets/sprites/devin-spritesheet.webp`.

## Suggested Component Shape

```ts
type DevinPetState =
  | "idle"
  | "thinking"
  | "working"
  | "success"
  | "blocked"
  | "warning"
  | "error"
  | "reminding"
  | "sleeping"
  | "waiting"
  | "celebrating"
  | "focused";

type DevinCompanionProps = {
  state: DevinPetState;
  size?: number;
  message?: string;
};
```

## Rendering Direction

React Native does not support CSS sprite background positioning the same way web does. For DevinX, use one of these approaches:

1. Split atlas frames into individual PNG/WebP frame files and animate `Image` source changes.
2. Use a masked/cropped atlas view if the app already has a reliable sprite component.
3. Start with a small set of extracted key frames per state, then upgrade to full animation once placement is approved.

The lowest-risk v1 is option 1. This package already includes extracted frame folders under `assets/frames/*`.

## Event Mapping

Use `events.json` as the adapter layer:

- `task_started` -> `working`
- `task_completed` -> `success`
- `task_failed` -> `error`
- `approval_required` -> `blocked`
- `delete_requested` -> `warning`
- `reminder_due` -> `reminding`
- `waiting_for_input` -> `waiting`

## Product Boundary

Do not build a system-wide iOS overlay. Keep Devin inside DevinX until there is a specific approved Apple-native surface such as a widget, Live Activity, or watch/lock-screen companion.
