jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('@components/InlineMedia', () => ({
  InlineImage: ({ alt }: { alt: string }) => {
    const React = jest.requireActual('react');
    const { View } = jest.requireActual('react-native');
    return React.createElement(View, { accessibilityLabel: `Image artifact: ${alt}` });
  },
  InlineVideo: ({ accessibilityLabel }: { accessibilityLabel: string }) => {
    const React = jest.requireActual('react');
    const { View } = jest.requireActual('react-native');
    return React.createElement(View, { accessibilityLabel });
  },
}));

jest.mock('@api/devin/useAttachmentFile', () => ({
  useAttachmentFile: (_attachment: unknown, enabled: boolean) =>
    enabled ? { status: 'ready', uri: 'file:///cached-artifact' } : { status: 'idle', uri: null },
}));

import { fireEvent, render } from '@testing-library/react-native';
import { SessionArtifactGallery } from '../../src/components/SessionArtifactGallery';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import type { SessionAttachment } from '../../src/api/devin/types';

const attachments: SessionAttachment[] = [
  {
    attachment_id: 'image-1',
    name: 'final-screen.png',
    source: 'devin',
    url: 'https://cdn.example.com/final-screen.png?signature=redacted',
    content_type: 'image/png',
  },
  {
    attachment_id: 'video-1',
    name: 'demo.mp4',
    source: 'devin',
    url: 'https://cdn.example.com/demo?signature=redacted',
    content_type: 'video/mp4',
  },
  {
    attachment_id: 'user-image',
    name: 'input.png',
    source: 'user',
    url: 'https://cdn.example.com/input.png',
    content_type: 'image/png',
  },
  {
    attachment_id: 'report',
    name: 'report.pdf',
    source: 'devin',
    url: 'https://cdn.example.com/report.pdf',
    content_type: 'application/pdf',
  },
];

describe('SessionArtifactGallery', () => {
  it('renders Devin images and lazy-loads Devin videos only after an explicit tap', () => {
    const screen = render(
      <ThemeProvider>
        <SessionArtifactGallery attachments={attachments} />
      </ThemeProvider>,
    );

    expect(screen.getByLabelText('Image artifact: final-screen.png')).toBeTruthy();
    expect(screen.queryByText('input.png')).toBeNull();
    expect(screen.queryByText('report.pdf')).toBeNull();
    expect(screen.queryByLabelText('Video demo: demo.mp4')).toBeNull();

    fireEvent.press(screen.getByLabelText('Play demo.mp4'));

    expect(screen.getByLabelText('Video demo: demo.mp4')).toBeTruthy();
  });

  it('offers an explicit refresh without exposing attachment URLs', () => {
    const onRefresh = jest.fn();
    const screen = render(
      <ThemeProvider>
        <SessionArtifactGallery attachments={attachments} onRefresh={onRefresh} />
      </ThemeProvider>,
    );

    fireEvent.press(screen.getByLabelText('Refresh demo and output files'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/signature=redacted/)).toBeNull();
  });

  it('renders an API attachment referenced by a Devin message even when its source is user', () => {
    const screen = render(
      <ThemeProvider>
        <SessionArtifactGallery
          attachments={attachments}
          messageAttachments={[
            {
              attachment_id: 'user-image',
              name: 'input.png',
              source: 'devin',
              url: 'https://cdn.example.com/input.png',
              content_type: 'image/png',
            },
          ]}
        />
      </ThemeProvider>,
    );

    expect(screen.getByLabelText('Image artifact: input.png')).toBeTruthy();
    expect(screen.getAllByText('Added by Devin')).toHaveLength(3);
  });
});
