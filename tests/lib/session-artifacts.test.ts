import {
  isSafeSessionArtifactUrl,
  parseSessionMessageArtifacts,
  sessionArtifactKind,
} from '../../src/lib/session-artifacts';

describe('session artifact classification', () => {
  it('uses the documented content type before the filename extension', () => {
    expect(
      sessionArtifactKind({
        content_type: 'video/mp4; charset=binary',
        url: 'https://cdn.example.com/download?id=1',
      }),
    ).toBe('video');
    expect(
      sessionArtifactKind({
        content_type: 'application/pdf',
        url: 'https://cdn.example.com/not-really-an-image.png',
      }),
    ).toBe('file');
  });

  it('falls back to the HTTPS URL path for absent or generic content types', () => {
    expect(
      sessionArtifactKind({
        content_type: null,
        url: 'https://cdn.example.com/demo.MOV?signature=redacted',
      }),
    ).toBe('video');
    expect(
      sessionArtifactKind({
        content_type: 'application/octet-stream',
        url: 'https://cdn.example.com/screenshot.webp#preview',
      }),
    ).toBe('image');
  });

  it('rejects unsafe schemes and URLs containing embedded credentials', () => {
    expect(isSafeSessionArtifactUrl('http://cdn.example.com/demo.mp4')).toBe(false);
    expect(isSafeSessionArtifactUrl('https://user:pass@cdn.example.com/demo.mp4')).toBe(false);
    expect(isSafeSessionArtifactUrl('not a URL')).toBe(false);
    expect(
      sessionArtifactKind({
        content_type: 'video/mp4',
        url: 'file:///tmp/demo.mp4',
      }),
    ).toBe('unsafe');
  });

  it('extracts Devin attachment transport markers without showing their raw JSON', () => {
    const parsed = parseSessionMessageArtifacts(
      'Finished the demo.\n\nATTACHMENT:{"url":"https://app.devin.ai/attachments/id/screen.png","fileSize":123}\nATTACHMENT:{"url":"https://app.devin.ai/attachments/id/demo.mp4","fileSize":456}',
    );

    expect(parsed.displayText).toBe('Finished the demo.');
    expect(parsed.attachments).toEqual([
      expect.objectContaining({ name: 'screen.png', source: 'devin', content_type: 'image/png' }),
      expect.objectContaining({ name: 'demo.mp4', source: 'devin', content_type: 'video/mp4' }),
    ]);
  });

  it('leaves malformed or unsafe attachment markers visible instead of trusting them', () => {
    const unsafe = 'ATTACHMENT:{"url":"http://example.com/screen.png"}';
    expect(parseSessionMessageArtifacts(unsafe)).toEqual({ displayText: unsafe, attachments: [] });
  });
});
