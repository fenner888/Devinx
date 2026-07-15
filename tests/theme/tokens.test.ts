/**
 * Token extraction tests — verify the §5.0 audit values are encoded and
 * every [FALLBACK-REPLACED] value differs from the spec §5.1 fallback.
 */

import { dark, light, statusLabels, radii, fonts, typeScale } from '../../src/theme/tokens';

function rgba(hex: string): [number, number, number, number] {
  const value = hex.slice(1);
  const normalized = value.length === 6 ? `${value}FF` : value;
  return [0, 2, 4, 6].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255) as [
    number,
    number,
    number,
    number,
  ];
}

function luminance(rgb: readonly number[]): number {
  const linear = rgb.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrast(foreground: string, background: string): number {
  const fg = rgba(foreground);
  const bg = rgba(background);
  const composited = fg.slice(0, 3).map((channel, index) => channel * fg[3] + bg[index]! * (1 - fg[3]));
  const foregroundLuminance = luminance(composited);
  const backgroundLuminance = luminance(bg);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

describe('design tokens (§5.0 extraction)', () => {
  it('uses a true-black product canvas in dark mode', () => {
    expect(dark.canvas.hex).toBe('#000000');
    expect(light.canvas.hex).toBe('#FCFCFC');
  });

  it('dark surface0 is the extracted #141414, not the fallback #0B0E14', () => {
    expect(dark.surface0.hex).toBe('#141414');
    expect(dark.surface0.hex).not.toBe('#0B0E14');
  });

  it('dark brand is the extracted #4489FF, not the fallback #3B82F6', () => {
    expect(dark.brand.hex).toBe('#4489FF');
    expect(dark.brand.hex).not.toBe('#3B82F6');
  });

  it('keeps the Home companion stage on semantic blue theme tokens', () => {
    expect(dark.companionStageSurface.hex).toBe('#04102B');
    expect(dark.companionStageLine.hex).toBe('#49B0FFB8');
    expect(light.companionStageSurface.hex).toBe('#E6EFFF');
    expect(light.companionStageLine.hex).toBe('#317CFF6B');
  });

  it('dark finished is the extracted #00EC7E, not the fallback #22C55E', () => {
    expect(dark.finished.hex).toBe('#00EC7E');
  });

  it('light surface0 is the extracted #FCFCFC, not the fallback #FAF7F2', () => {
    expect(light.surface0.hex).toBe('#FCFCFC');
  });

  it('status labels match the exact web-app vocabulary', () => {
    expect(statusLabels.working).toBe('Working');
    expect(statusLabels.waitingForResponse).toBe('Waiting for response');
    expect(statusLabels.exceededLimit).toBe('Exceeded limit');
    expect(statusLabels.prReady).toBe('PR is ready');
    expect(statusLabels.sleeping).toBe('Sleeping');
    expect(statusLabels.crashed).toBe('Crashed');
  });

  it('radii use the extracted 6px workhorse, not the fallback 12px', () => {
    expect(radii.card).toBe(6);
    expect(radii.card).not.toBe(12);
    expect(radii.chip).toBe(9999);
  });

  it('mono font lists SF Mono first (Devin live), with JetBrains Mono fallback', () => {
    expect(fonts.mono.startsWith('"SF Mono"')).toBe(true);
    expect(fonts.mono).toContain('JetBrains Mono');
  });

  it('type scale is the dense Devin scale, not the fallback 15/17/20', () => {
    expect(typeScale.text13).toBe(13);
    expect(typeScale.text14).toBe(14);
    expect(typeScale).not.toHaveProperty('text15');
    expect(typeScale).not.toHaveProperty('text20');
  });

  it.each([
    ['dark primary on canvas', dark.textHi.hex, dark.canvas.hex],
    ['dark secondary on canvas', dark.textMid.hex, dark.canvas.hex],
    ['dark link on canvas', dark.link.hex, dark.canvas.hex],
    ['light primary on canvas', light.textHi.hex, light.canvas.hex],
    ['light secondary on canvas', light.textMid.hex, light.canvas.hex],
    ['light link on canvas', light.brandText.hex, light.canvas.hex],
  ])('%s clears WCAG AA contrast for normal text', (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});
