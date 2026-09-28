export function utf8Tail(
  value: string,
  maximumBytes: number,
): { text: string; truncated: boolean } {
  const bytes = Buffer.from(value, 'utf8');
  try {
    if (bytes.length <= maximumBytes) return { text: value, truncated: false };
    let text = bytes.subarray(bytes.length - maximumBytes).toString('utf8');
    while (text.startsWith('�')) text = text.slice(1);
    return { text, truncated: true };
  } finally {
    bytes.fill(0);
  }
}
