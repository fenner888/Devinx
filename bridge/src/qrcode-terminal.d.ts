declare module 'qrcode-terminal' {
  type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

  interface QrCodeTerminal {
    setErrorLevel(level: ErrorCorrectionLevel): void;
    generate(
      input: string,
      options: { small?: boolean },
      callback: (qrCode: string) => void,
    ): void;
  }

  const qrCodeTerminal: QrCodeTerminal;
  export default qrCodeTerminal;
}
