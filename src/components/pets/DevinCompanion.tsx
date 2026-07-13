import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { DEVIN_FRAME_SETS } from '@/pets/devin/assets';
import { DEVIN_STATE_ANIMATIONS } from '@/pets/devin/model';
import type { DevinCompanionProps } from '@/pets/devin/types';

const DEFAULT_SIZE = 72;
const COMPACT_MAX_SIZE = 48;
const TRAVEL_FRAMES_PER_SECOND = 8;
const TRAVEL_BODY_WIDTHS_PER_SECOND = 0.5;
const TURN_PAUSE_MS = 120;
const TRAVEL_CAPTION_HEIGHT = 40;
const styles = StyleSheet.create({
  touchThrough: { pointerEvents: 'none' },
  travelFrame: { bottom: 0, left: 0, position: 'absolute' },
  travelTrack: { overflow: 'hidden', width: '100%' },
});

function fallbackCaptionForState(state: DevinCompanionProps['state']): string {
  switch (state) {
    case 'thinking':
      return 'Thinking through the task';
    case 'working':
    case 'focused':
      return 'Working on your task';
    case 'success':
    case 'celebrating':
      return 'Task complete';
    case 'blocked':
      return 'Waiting for your reply';
    case 'warning':
    case 'error':
      return 'Needs your attention';
    case 'reminding':
      return 'Reminder';
    case 'sleeping':
      return 'Sleeping';
    case 'idle':
      return 'Ready';
    case 'waiting':
      return 'Waiting for your reply';
  }
}

export function DevinCompanion({
  state,
  size = DEFAULT_SIZE,
  message,
  compact = false,
  loop,
  active = true,
  travel = false,
  travelTrack = false,
  accessibilityLabel,
}: DevinCompanionProps) {
  // Start still until the platform preference resolves so Reduce Motion never
  // gets a brief animation flash on mount.
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(true);
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === 'active');
  const [frameIndex, setFrameIndex] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const [travelDirection, setTravelDirection] = useState<'left' | 'right'>('right');
  const travelX = useRef(new Animated.Value(0)).current;
  const travelDirectionRef = useRef<'left' | 'right'>('left');
  const trackPositionInitializedRef = useRef(false);
  const previousDistanceRef = useRef(0);

  const animation = DEVIN_STATE_ANIMATIONS[state];
  const shouldLoop = loop ?? animation.loop;
  const displaySize = compact ? Math.min(size, COMPACT_MAX_SIZE) : size;
  const frameRate = travel ? TRAVEL_FRAMES_PER_SECOND : animation.fps;
  const visibleMessage = compact ? undefined : message;
  const isTraveling = travel && active && !reduceMotionEnabled && isAppActive;
  const usesTravelTrack = travel || travelTrack;
  const frames = travel
    ? DEVIN_FRAME_SETS[travelDirection === 'right' ? 'running-right' : 'running-left']
    : animation.frames;
  const travelCaption = compact ? undefined : visibleMessage ?? fallbackCaptionForState(state);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(
      (enabled) => {
        if (mounted) setReduceMotionEnabled(enabled);
      },
      () => {
        // If the preference cannot be read, remain still rather than assuming
        // animation is acceptable.
      },
    );
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionEnabled,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setIsAppActive(nextState === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    setFrameIndex(0);
    if (!active || reduceMotionEnabled || !isAppActive || frames.length <= 1) return;

    const intervalMs = 1000 / frameRate;
    const intervalId = setInterval(() => {
      setFrameIndex((current) => {
        const next = current + 1;
        if (next < frames.length) return next;
        if (shouldLoop) return 0;
        clearInterval(intervalId);
        return frames.length - 1;
      });
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [active, frameRate, frames, isAppActive, reduceMotionEnabled, shouldLoop]);

  useEffect(() => {
    let cancelled = false;
    let turnTimeout: ReturnType<typeof setTimeout> | undefined;
    const distance = Math.max(trackWidth - displaySize, 0);
    const previousDistance = previousDistanceRef.current;
    previousDistanceRef.current = distance;

    const face = (direction: 'left' | 'right') => {
      travelDirectionRef.current = direction;
      setTravelDirection(direction);
    };

    const crossTrack = (destination: number, startingPosition: number) => {
      if (cancelled) return;
      const remainingDistance = Math.abs(destination - startingPosition);
      const travelSpeed = displaySize * TRAVEL_BODY_WIDTHS_PER_SECOND;
      const duration = Math.max(160, (remainingDistance / travelSpeed) * 1000);
      Animated.timing(travelX, {
        toValue: destination,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished || cancelled) return;
        const returningLeft = destination === distance;
        face(returningLeft ? 'left' : 'right');
        const nextDestination = returningLeft ? 0 : distance;
        turnTimeout = setTimeout(
          () => crossTrack(nextDestination, destination),
          TURN_PAUSE_MS,
        );
      });
    };

    travelX.stopAnimation((currentPosition) => {
      if (cancelled || distance === 0) return;

      if (!trackPositionInitializedRef.current) {
        trackPositionInitializedRef.current = true;
        travelX.setValue(distance);
        face('left');
        if (isTraveling) crossTrack(0, distance);
        return;
      }

      const wasAtRightEdge = Math.abs(currentPosition - previousDistance) < 1;
      const clampedPosition = Math.min(Math.max(currentPosition, 0), distance);
      const restingPosition = !isTraveling && wasAtRightEdge ? distance : clampedPosition;
      travelX.setValue(restingPosition);

      // A completed task stays exactly where Devin stopped. Starting again
      // resumes from that position instead of remounting or snapping edges.
      if (!isTraveling) return;

      let direction = travelDirectionRef.current;
      let destination = direction === 'right' ? distance : 0;
      if (Math.abs(destination - restingPosition) < 1) {
        direction = direction === 'right' ? 'left' : 'right';
        destination = direction === 'right' ? distance : 0;
        face(direction);
      }
      crossTrack(destination, restingPosition);
    });

    return () => {
      cancelled = true;
      if (turnTimeout) clearTimeout(turnTimeout);
      travelX.stopAnimation();
    };
  }, [displaySize, isTraveling, trackWidth, travelX]);

  function handleTrackLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
  }

  const currentFrame = frames[frameIndex] ?? frames[0];
  if (currentFrame === undefined) return null;

  const frame = (
    <Image
      testID="devin-companion-frame"
      source={currentFrame}
      style={{ width: displaySize, height: displaySize }}
      resizeMode="contain"
      accessible={false}
    />
  );

  if (usesTravelTrack) {
    return (
      <View
        style={styles.touchThrough}
        accessible
        accessibilityLabel={accessibilityLabel ?? travelCaption ?? `Devin companion, ${state}`}
      >
        <View
          testID="devin-companion-track"
          style={[{ height: displaySize + TRAVEL_CAPTION_HEIGHT }, styles.travelTrack]}
          onLayout={handleTrackLayout}
        >
          <Animated.View
            testID="devin-companion-traveler"
            style={[
              styles.travelFrame,
              {
                height: displaySize + TRAVEL_CAPTION_HEIGHT,
                width: displaySize,
                transform: [{ translateX: travelX }],
              },
            ]}
          >
            {travelCaption && (
              <View
                testID="devin-companion-task-caption"
                className="h-10 w-full items-center justify-end pb-1"
              >
                <View className="max-w-full rounded-chip border border-border-subtle bg-surface1 px-1.5 py-1">
                  <Text className="text-center text-text-mid text-text11" numberOfLines={2}>
                    {travelCaption}
                  </Text>
                </View>
              </View>
            )}
            {frame}
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <View
      className="flex-row items-center justify-end"
      style={[{ height: displaySize }, styles.touchThrough]}
      accessible
      accessibilityLabel={accessibilityLabel ?? visibleMessage ?? `Devin companion, ${state}`}
    >
      {visibleMessage && (
        <View className="mr-2 max-w-56 rounded-chip border border-border-subtle bg-surface1 px-3 py-1.5">
          <Text className="text-text-mid text-text12">{visibleMessage}</Text>
        </View>
      )}
      {frame}
    </View>
  );
}
