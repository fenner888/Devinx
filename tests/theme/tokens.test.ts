/**
 * Token extraction tests — verify the §5.0 audit values are encoded and
 * every [FALLBACK-REPLACED] value differs from the spec §5.1 fallback.
 */

import { dark, light, statusLabels, radii, fonts, typeScale } from '../../src/theme/tokens';

describe('design tokens (§5.0 extraction)', () => {
  it('dark surface0 is the extracted #141414, not the fallback #0B0E14', () => {
    expect(dark.surface0.hex).toBe('#141414');
    expect(dark.surface0.hex).not.toBe('#0B0E14');
  });

  it('dark brand is the extracted #4489FF, not the fallback #3B82F6', () => {
    expect(dark.brand.hex).toBe('#4489FF');
    expect(dark.brand.hex).not.toBe('#3B82F6');
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
});
