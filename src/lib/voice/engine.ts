import VoiceNative, {
  type TranscriptionUpdate,
  type VoiceAvailability,
  type VoiceLevelUpdate,
  type VoiceStateUpdate,
} from '../../../modules/devinx-voice/src';

export interface TranscriptionListeners {
  onTranscript(update: TranscriptionUpdate): void;
  onLevel(level: number): void;
  onState(update: VoiceStateUpdate): void;
}

export interface TranscriptionSession {
  stop(): Promise<string>;
  cancel(): Promise<void>;
  removeListeners(): void;
}

export interface TranscriptionEngine {
  availability(): Promise<VoiceAvailability>;
  prepare(hints: string[]): Promise<void>;
  start(hints: string[], listeners: TranscriptionListeners): Promise<TranscriptionSession>;
}

export const speechAnalyzerEngine: TranscriptionEngine = {
  async availability() {
    if (!VoiceNative) return 'unsupportedOS';
    return VoiceNative.availability();
  },

  async prepare(hints) {
    if (!VoiceNative) throw new Error('On-device dictation is unavailable.');
    await VoiceNative.prepare(hints);
  },

  async start(hints, listeners) {
    const native = VoiceNative;
    if (!native) throw new Error('On-device dictation is unavailable.');
    const transcriptSubscription = native.addListener(
      'onTranscriptionUpdate',
      listeners.onTranscript,
    );
    const levelSubscription = native.addListener('onVoiceLevel', (event: VoiceLevelUpdate) => {
      listeners.onLevel(event.level);
    });
    const stateSubscription = native.addListener('onVoiceState', listeners.onState);
    const removeListeners = () => {
      transcriptSubscription.remove();
      levelSubscription.remove();
      stateSubscription.remove();
    };
    try {
      await native.start(hints);
    } catch (error) {
      removeListeners();
      throw error;
    }
    return {
      stop: () => native.stop(),
      cancel: () => native.cancel(),
      removeListeners,
    };
  },
};
