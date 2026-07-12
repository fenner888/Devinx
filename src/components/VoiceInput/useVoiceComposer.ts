import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  AccessibilityInfo,
  Linking,
  type NativeSyntheticEvent,
  type TextInput,
  type TextInputSelectionChangeEventData,
} from 'react-native';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';

import { hapticError, hapticLight, hapticWarning } from '@lib/haptics';
import {
  speechAnalyzerEngine,
  type TranscriptionSession,
} from '@lib/voice/engine';
import { assembleVoiceHints, type VoiceHintSources } from '@lib/voice/hints';
import {
  onDeviceScribeEngine,
  type ScribeContext,
  type ScribeResult,
} from '@lib/voice/scribe';

type VoicePhase = 'idle' | 'preparing' | 'recording' | 'stopping' | 'structuring';

export interface VoiceComposerController {
  inputRef: RefObject<TextInput | null>;
  phase: VoicePhase;
  isRecording: boolean;
  elapsedSeconds: number;
  level: number;
  reduceMotion: boolean;
  error: string | null;
  permissionDenied: boolean;
  canStructure: boolean;
  scribePreview: ScribeResult | null;
  rawPreview: string;
  onSelectionChange(event: NativeSyntheticEvent<TextInputSelectionChangeEventData>): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  cancel(): Promise<void>;
  structure(): Promise<void>;
  applyStructured(): void;
  closePreview(): void;
  clearError(): void;
  openSettings(): void;
}

interface UseVoiceComposerOptions {
  value: string;
  onChangeText(value: string): void;
  disabled?: boolean;
  maximumLength?: number;
  hints?: VoiceHintSources;
  scribeContext?: ScribeContext;
}

const SCRIBE_WORD_THRESHOLD = 15;
const FIVE_MINUTES_SECONDS = 5 * 60;

function countWords(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

export function insertSpokenText(
  current: string,
  start: number,
  end: number,
  spoken: string,
  maximumLength = Number.POSITIVE_INFINITY,
) {
  const clean = spoken.trim();
  const prefix = start > 0 && !/\s/.test(current[start - 1] ?? '') ? ' ' : '';
  const suffix = end < current.length && !/\s|[,.!?;:]/.test(current[end] ?? '') ? ' ' : '';
  const requested = `${prefix}${clean}${suffix}`;
  const available = Math.max(0, maximumLength - (current.length - (end - start)));
  let inserted = requested.slice(0, available);
  if (inserted.length < requested.length && suffix && !/\s$/.test(inserted)) {
    inserted = inserted.replace(/\S+$/, '');
  }
  return {
    value: `${current.slice(0, start)}${inserted}${current.slice(end)}`,
    cursor: start + inserted.length,
    inserted,
  };
}

function publicVoiceError(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  if (code.includes('ASSET')) {
    return 'On-device dictation is still preparing. Check your connection and try again.';
  }
  if (code.includes('AUDIO')) {
    return 'The microphone could not be started. Check the active audio device and try again.';
  }
  return 'Dictation could not start. Your typed draft is unchanged.';
}

export function useVoiceComposer({
  value,
  onChangeText,
  disabled = false,
  maximumLength = 100_000,
  hints,
  scribeContext = {},
}: UseVoiceComposerOptions): VoiceComposerController {
  const inputRef = useRef<TextInput>(null);
  const valueRef = useRef(value);
  const selectionRef = useRef({ start: value.length, end: value.length });
  const sessionRef = useRef<TranscriptionSession | null>(null);
  const lastFinalRef = useRef('');
  const dictatedWordsRef = useRef(0);
  const warnedAtFiveMinutesRef = useRef(false);
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [dictatedWords, setDictatedWords] = useState(0);
  const [scribePreview, setScribePreview] = useState<ScribeResult | null>(null);
  const [rawPreview, setRawPreview] = useState('');

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = setInterval(() => setElapsedSeconds((current) => current + 1), 1_000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (
      elapsedSeconds >= FIVE_MINUTES_SECONDS &&
      phase === 'recording' &&
      !warnedAtFiveMinutesRef.current
    ) {
      warnedAtFiveMinutesRef.current = true;
      hapticWarning();
    }
  }, [elapsedSeconds, phase]);

  useEffect(
    () => () => {
      const session = sessionRef.current;
      sessionRef.current = null;
      session?.cancel().catch(() => {});
      session?.removeListeners();
    },
    [],
  );

  const placeCursor = useCallback((cursor: number) => {
    selectionRef.current = { start: cursor, end: cursor };
    requestAnimationFrame(() => {
      inputRef.current?.setNativeProps({ selection: { start: cursor, end: cursor } });
    });
  }, []);

  const insertFinalizedText = useCallback(
    (nativeFinal: string) => {
      const previous = lastFinalRef.current;
      if (!nativeFinal || nativeFinal === previous) return;
      const addition = nativeFinal.startsWith(previous)
        ? nativeFinal.slice(previous.length).trim()
        : nativeFinal.trim();
      lastFinalRef.current = nativeFinal;
      if (!addition) return;

      const current = valueRef.current;
      const selection = selectionRef.current;
      const insertion = insertSpokenText(
        current,
        selection.start,
        selection.end,
        addition,
        maximumLength,
      );
      const next = insertion.value;
      valueRef.current = next;
      onChangeText(next);
      placeCursor(Math.min(insertion.cursor, next.length));
      dictatedWordsRef.current += countWords(insertion.inserted);
      setDictatedWords(dictatedWordsRef.current);
    },
    [maximumLength, onChangeText, placeCursor],
  );

  const finishSession = useCallback(() => {
    sessionRef.current?.removeListeners();
    sessionRef.current = null;
    setPhase('idle');
    setLevel(0);
  }, []);

  const start = useCallback(async () => {
    if (disabled || phase !== 'idle') return;
    setError(null);
    setPermissionDenied(false);
    setPhase('preparing');
    setElapsedSeconds(0);
    setLevel(0);
    lastFinalRef.current = '';
    warnedAtFiveMinutesRef.current = false;
    try {
      const availability = await speechAnalyzerEngine.availability();
      if (availability !== 'available') {
        setError(
          availability === 'unsupportedOS'
            ? 'On-device dictation requires iOS 26 or later. Typing remains available.'
            : 'On-device dictation is not available on this iPhone. Typing remains available.',
        );
        setPhase('idle');
        return;
      }
      let permission = await getRecordingPermissionsAsync();
      if (!permission.granted) permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setPermissionDenied(true);
        setError('Microphone access is off. Enable it in Settings to use dictation.');
        setPhase('idle');
        return;
      }
      const voiceHints = assembleVoiceHints(hints);
      await speechAnalyzerEngine.prepare(voiceHints);
      sessionRef.current = await speechAnalyzerEngine.start(voiceHints, {
        onTranscript(update) {
          insertFinalizedText(update.finalText);
        },
        onLevel(nextLevel) {
          setLevel(nextLevel);
        },
        onState(update) {
          if (update.state === 'recording') setPhase('recording');
          if (update.state === 'interrupted') {
            finishSession();
            setError('Dictation stopped when audio was interrupted. Finalized words were preserved.');
          }
          if (update.state === 'error') {
            finishSession();
            setError('Dictation stopped unexpectedly. Finalized words were preserved.');
          }
        },
      });
      setPhase('recording');
      hapticLight();
    } catch (voiceError) {
      finishSession();
      setError(publicVoiceError(voiceError));
      hapticError();
    }
  }, [disabled, finishSession, hints, insertFinalizedText, phase]);

  const stop = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || phase !== 'recording') return;
    setPhase('stopping');
    try {
      const finalTranscript = await session.stop();
      insertFinalizedText(finalTranscript);
    } catch (voiceError) {
      setError(publicVoiceError(voiceError));
      hapticError();
    } finally {
      finishSession();
      inputRef.current?.focus();
    }
  }, [finishSession, insertFinalizedText, phase]);

  const cancel = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      await session.cancel();
    } finally {
      finishSession();
      inputRef.current?.focus();
    }
  }, [finishSession]);

  const structure = useCallback(async () => {
    if (phase !== 'idle' || countWords(valueRef.current) === 0) return;
    const raw = valueRef.current;
    setRawPreview(raw);
    setPhase('structuring');
    setError(null);
    try {
      setScribePreview(await onDeviceScribeEngine.structure(raw, scribeContext));
    } catch {
      setError('The work order could not be structured. Your original draft is unchanged.');
      hapticError();
    } finally {
      setPhase('idle');
    }
  }, [phase, scribeContext]);

  const applyStructured = useCallback(() => {
    if (!scribePreview) return;
    valueRef.current = scribePreview.text.slice(0, maximumLength);
    onChangeText(valueRef.current);
    placeCursor(valueRef.current.length);
    setScribePreview(null);
    setRawPreview('');
    hapticLight();
  }, [maximumLength, onChangeText, placeCursor, scribePreview]);

  return {
    inputRef,
    phase,
    isRecording: phase === 'recording' || phase === 'stopping',
    elapsedSeconds,
    level,
    reduceMotion,
    error,
    permissionDenied,
    canStructure: dictatedWords >= SCRIBE_WORD_THRESHOLD && phase === 'idle',
    scribePreview,
    rawPreview,
    onSelectionChange(event) {
      selectionRef.current = event.nativeEvent.selection;
    },
    start,
    stop,
    cancel,
    structure,
    applyStructured,
    closePreview() {
      setScribePreview(null);
      setRawPreview('');
    },
    clearError() {
      setError(null);
    },
    openSettings() {
      Linking.openSettings().catch(() => {});
    },
  };
}
