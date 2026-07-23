import {
  MAX_STRUCTURED_OUTPUT_SCHEMA_BYTES,
  normalizeSessionSecrets,
  parseSessionLinks,
  parseStructuredOutputSchema,
  utf8ByteLength,
} from '../../src/lib/session-create-options';

describe('advanced session-create options', () => {
  it('normalizes one link per line', () => {
    expect(parseSessionLinks(' https://example.com/a \n\nhttps://example.com/b ')).toEqual([
      'https://example.com/a',
      'https://example.com/b',
    ]);
    expect(parseSessionLinks('   ')).toBeUndefined();
  });

  it('parses only bounded JSON objects as structured-output schemas', () => {
    expect(parseStructuredOutputSchema('{"type":"object"}')).toEqual({ type: 'object' });
    expect(parseStructuredOutputSchema('')).toBeUndefined();
    expect(() => parseStructuredOutputSchema('[]')).toThrow('JSON object');
    expect(() => parseStructuredOutputSchema('{oops')).toThrow('valid JSON');
    expect(() =>
      parseStructuredOutputSchema('{"$ref":"https://example.com/schema.json"}'),
    ).toThrow('external $ref');
    expect(parseStructuredOutputSchema('{"$ref":"#/$defs/result"}')).toEqual({
      $ref: '#/$defs/result',
    });
    expect(() =>
      parseStructuredOutputSchema(`{"value":"${'a'.repeat(MAX_STRUCTURED_OUTPUT_SCHEMA_BYTES)}"}`),
    ).toThrow('64 KB');
  });

  it('measures UTF-8 bytes rather than UTF-16 code units', () => {
    expect(utf8ByteLength('a')).toBe(1);
    expect(utf8ByteLength('é')).toBe(2);
    expect(utf8ByteLength('😀')).toBe(4);
  });

  it('keeps transient secrets sensitive and rejects partial rows', () => {
    expect(normalizeSessionSecrets([{ key: ' TOKEN ', value: 'value' }])).toEqual([
      { key: 'TOKEN', value: 'value', sensitive: true },
    ]);
    expect(normalizeSessionSecrets([])).toBeUndefined();
    expect(() => normalizeSessionSecrets([{ key: 'TOKEN', value: '' }])).toThrow(
      'both a name and a value',
    );
  });
});
