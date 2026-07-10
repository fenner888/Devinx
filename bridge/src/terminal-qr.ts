import qrCodeTerminal from 'qrcode-terminal';

import { z } from 'zod';

import type { PairingQrRenderer } from './runner';

const pairingPayloadSchema = z.string().min(1).max(2_048);

export class TerminalQrRenderer implements PairingQrRenderer {
  render(input: string): void {
    const payload = pairingPayloadSchema.parse(input);
    let rendered: string | undefined;
    qrCodeTerminal.setErrorLevel('M');
    qrCodeTerminal.generate(payload, { small: true }, (qrCode) => {
      rendered = qrCode;
    });
    if (!rendered) throw new Error('Pairing QR code could not be rendered');
    process.stdout.write(`${rendered}\n`);
  }
}
