import type { ImageSourcePropType } from 'react-native';

import claude from '../../../assets/model-marks/claude.png';
import cognition from '../../../assets/model-marks/cognition.png';
import deepseek from '../../../assets/model-marks/deepseek.png';
import gemini from '../../../assets/model-marks/gemini.png';
import grok from '../../../assets/model-marks/grok.png';
import openai from '../../../assets/model-marks/openai.png';
import zai from '../../../assets/model-marks/zai.png';

import type { ModelFamilyMarkKind } from '@lib/model-family-mark';

export interface ModelFamilyMarkAsset {
  source: ImageSourcePropType;
  /** Scale within the fixed mark slot while preserving the supplied artwork. */
  scale: number;
  /** Monochrome marks that need contrast only in the named app theme. */
  contrastTile?: 'dark' | 'light';
}

/**
 * Verified first-party model/provider marks. These are presentation metadata
 * only: the live ACP catalog remains the sole source of selectable models.
 */
export const MODEL_FAMILY_MARK_ASSETS: Partial<
  Record<ModelFamilyMarkKind, ModelFamilyMarkAsset>
> = {
  claude: { source: claude, scale: 0.86 },
  glm: { source: zai, scale: 0.88 },
  swe: { source: cognition, scale: 0.78, contrastTile: 'light' },
  gpt: { source: openai, scale: 0.68, contrastTile: 'dark' },
  gemini: { source: gemini, scale: 0.82 },
  deepseek: { source: deepseek, scale: 0.88 },
  grok: { source: grok, scale: 0.76, contrastTile: 'light' },
};
