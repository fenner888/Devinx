import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

const MARKS = [
  'claude',
  'cognition',
  'deepseek',
  'gemini',
  'grok',
  'kimi-dark',
  'kimi-light',
  'openai',
  'zai',
];

function paethPredictor(left: number, up: number, upperLeft: number) {
  const prediction = left + up - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const upDistance = Math.abs(prediction - up);
  const upperLeftDistance = Math.abs(prediction - upperLeft);

  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  if (upDistance <= upperLeftDistance) return up;
  return upperLeft;
}

function alphaRange(filePath: string) {
  const png = readFileSync(filePath);
  const idatChunks: Buffer[] = [];
  let width = 0;
  let height = 0;
  let offset = 8;

  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect(data[8]).toBe(8);
      expect(data[9]).toBe(6);
      expect(data[12]).toBe(0);
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }

    offset += length + 12;
  }

  const bytesPerPixel = 4;
  const rowLength = width * bytesPerPixel;
  const decoded = inflateSync(Buffer.concat(idatChunks));
  let previousRow = Buffer.alloc(rowLength);
  let decodedOffset = 0;
  let min = 255;
  let max = 0;

  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const filter = decoded[decodedOffset] ?? 0;
    decodedOffset += 1;
    const rawRow = decoded.subarray(decodedOffset, decodedOffset + rowLength);
    decodedOffset += rowLength;
    const row = Buffer.alloc(rowLength);

    for (let column = 0; column < rowLength; column += 1) {
      const left = column >= bytesPerPixel ? (row[column - bytesPerPixel] ?? 0) : 0;
      const up = previousRow[column] ?? 0;
      const upperLeft =
        column >= bytesPerPixel ? (previousRow[column - bytesPerPixel] ?? 0) : 0;
      let predictor = 0;

      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paethPredictor(left, up, upperLeft);
      else if (filter !== 0) throw new Error(`Unsupported PNG row filter: ${filter}`);

      row[column] = ((rawRow[column] ?? 0) + predictor) % 256;
    }

    for (let alphaOffset = 3; alphaOffset < row.length; alphaOffset += bytesPerPixel) {
      min = Math.min(min, row[alphaOffset] ?? 0);
      max = Math.max(max, row[alphaOffset] ?? 0);
    }
    previousRow = row;
  }

  return { min, max };
}

describe('model mark transparency', () => {
  it.each(MARKS)('%s has both transparent canvas and visible artwork', (mark) => {
    const range = alphaRange(join(process.cwd(), 'assets', 'model-marks', `${mark}.png`));

    expect(range).toEqual({ min: 0, max: 255 });
  });
});
