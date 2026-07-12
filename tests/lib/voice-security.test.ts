import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const voiceFiles = [
  path.join(ROOT, 'src/lib/voice/engine.ts'),
  path.join(ROOT, 'src/lib/voice/hints.ts'),
  path.join(ROOT, 'src/lib/voice/scribe.ts'),
  path.join(ROOT, 'modules/devinx-voice/ios/DevinXVoiceModule.swift'),
];

describe('voice privacy gates', () => {
  it('has no network client or request APIs in the voice boundary', () => {
    for (const file of voiceFiles) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/\b(?:fetch|axios|URLSession|WebSocket|NSURLRequest)\b/);
      expect(source).not.toMatch(/from\s+['"]@api\//);
    }
  });

  it('does not write microphone audio to files or temporary storage', () => {
    const nativeSource = fs.readFileSync(voiceFiles[3]!, 'utf8');
    expect(nativeSource).not.toMatch(/FileManager|temporaryDirectory|write\s*\(|AVAudioFile/);
    expect(nativeSource).toContain('AVAudioPCMBuffer');
  });

  it('keeps the exact on-device microphone disclosure in app configuration', () => {
    const appConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')) as {
      expo: { ios: { infoPlist: Record<string, unknown> } };
    };
    expect(appConfig.expo.ios.infoPlist.NSMicrophoneUsageDescription).toBe(
      'DevinX uses the microphone to transcribe your voice into session prompts. Audio is processed entirely on your device and never uploaded.',
    );
  });
});
