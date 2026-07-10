export const DEVIN_PET_STATES = [
  'idle',
  'thinking',
  'working',
  'success',
  'blocked',
  'warning',
  'error',
  'reminding',
  'sleeping',
  'waiting',
  'celebrating',
  'focused',
] as const;

export type DevinPetState = (typeof DEVIN_PET_STATES)[number];

export type DevinFrameSource = number;

export type DevinAnimationDefinition = {
  frames: readonly DevinFrameSource[];
  fps: number;
  loop: boolean;
};

export type DevinCompanionProps = {
  state: DevinPetState;
  size?: number;
  message?: string;
  compact?: boolean;
  loop?: boolean;
  active?: boolean;
  travel?: boolean;
  travelTrack?: boolean;
  accessibilityLabel?: string;
};
