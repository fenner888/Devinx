import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { ModelFamilyMark } from '../../src/components/sessions/ModelFamilyMark';

describe('ModelFamilyMark', () => {
  it.each(['claude', 'glm', 'swe', 'gpt', 'gemini', 'deepseek', 'grok'])(
    'renders the verified %s asset instead of an approximated glyph',
    (family) => {
      render(<ModelFamilyMark name={family} />);

      expect(screen.getByTestId(`model-family-mark-${family}`)).toBeTruthy();
      expect(screen.getByTestId(`model-family-mark-image-${family}`)).toBeTruthy();
    },
  );

  it.each(['glm', 'gpt', 'grok'])('theme-tints the transparent %s mark', (family) => {
    render(<ModelFamilyMark name={family} />);

    expect(screen.getByTestId(`model-family-mark-image-${family}`).props.style).toEqual(
      expect.objectContaining({ tintColor: expect.any(String) }),
    );
  });

  it.each(['claude', 'swe', 'gemini', 'deepseek'])(
    'preserves the supplied colors for the %s mark',
    (family) => {
      render(<ModelFamilyMark name={family} />);

      expect(screen.getByTestId(`model-family-mark-image-${family}`).props.style).toEqual(
        expect.objectContaining({ tintColor: undefined }),
      );
    },
  );
});
