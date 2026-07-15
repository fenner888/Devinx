import { NativeModule, requireOptionalNativeModule } from 'expo-modules-core';

export type VoiceAvailability = 'available' | 'unsupportedOS' | 'unavailable';
export type ScribeAvailability =
  | 'available'
  | 'unsupportedOS'
  | 'deviceNotEligible'
  | 'appleIntelligenceNotEnabled'
  | 'modelNotReady';

export interface TranscriptionUpdate {
  finalText: string;
  volatileText: string;
}

export interface VoiceLevelUpdate {
  level: number;
}

export interface VoiceStateUpdate {
  state: 'recording' | 'stopped' | 'cancelled' | 'interrupted' | 'error';
  reason?: string;
}

type DevinXVoiceEvents = {
  onTranscriptionUpdate(event: TranscriptionUpdate): void;
  onVoiceLevel(event: VoiceLevelUpdate): void;
  onVoiceState(event: VoiceStateUpdate): void;
};

declare class DevinXVoiceNativeModule extends NativeModule<DevinXVoiceEvents> {
  availability(): Promise<VoiceAvailability>;
  prepare(hints: string[]): Promise<void>;
  start(hints: string[]): Promise<void>;
  stop(): Promise<string>;
  cancel(): Promise<void>;
  scribeAvailability(): Promise<ScribeAvailability>;
  structureTranscript(transcript: string, context: string): Promise<string>;
}

export default requireOptionalNativeModule<DevinXVoiceNativeModule>('DevinXVoice');
