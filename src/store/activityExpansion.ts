/**
 * Zustand store — activity timeline expansion state. Memory only (no persist):
 * group keys `${bridgeId}/${sessionId}/${groupKey}`, step keys
 * `${bridgeId}/${sessionId}/${entryId}`.
 */

import { create } from 'zustand';

interface ActivityExpansionState {
  expanded: Record<string, boolean>;
  toggle: (key: string) => void;
  isExpanded: (key: string, fallback: boolean) => boolean;
}

export const useActivityExpansion = create<ActivityExpansionState>()((set, get) => ({
  expanded: {},
  toggle: (key) => set((state) => ({ expanded: { ...state.expanded, [key]: !state.expanded[key] } })),
  isExpanded: (key, fallback) => get().expanded[key] ?? fallback,
}));
