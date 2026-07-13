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

});
