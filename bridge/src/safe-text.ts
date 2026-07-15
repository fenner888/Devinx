export function safeDisplayText(input: string, maximumLength = 80): string {
  const characters = [...input].map((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    const unsafe =
      codePoint <= 31 ||
      (codePoint >= 127 && codePoint <= 159) ||
      (codePoint >= 0x200b && codePoint <= 0x200f) ||
      (codePoint >= 0x2028 && codePoint <= 0x202f) ||
      (codePoint >= 0x2060 && codePoint <= 0x206f) ||
      codePoint === 0xfeff;
    return unsafe ? ' ' : character;
  });
  const collapsed = characters.join('').replace(/\s+/g, ' ').trim();
  return [...collapsed].slice(0, maximumLength).join('') || 'Unnamed iPhone';
}
