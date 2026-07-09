/**
 * DevinMarkdown — renders Devin's chat replies as markdown (code blocks,
 * lists, headings, links) with theme-token styling, instead of plain text.
 */
import { Linking, Platform } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '@theme/index';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export function DevinMarkdown({ children }: { children: string }) {
  const { tokens } = useTheme();

  const styles = {
    body: { color: tokens.textHi.hex, fontSize: 14, lineHeight: 20 },
    heading1: { color: tokens.textHi.hex, fontSize: 18, fontWeight: '600' as const, marginTop: 8, marginBottom: 4 },
    heading2: { color: tokens.textHi.hex, fontSize: 16, fontWeight: '600' as const, marginTop: 8, marginBottom: 4 },
    heading3: { color: tokens.textHi.hex, fontSize: 15, fontWeight: '600' as const, marginTop: 6, marginBottom: 4 },
    strong: { color: tokens.textHi.hex, fontWeight: '700' as const },
    em: { fontStyle: 'italic' as const },
    link: { color: tokens.brandText.hex },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    list_item: { color: tokens.textHi.hex, marginVertical: 2 },
    blockquote: {
      backgroundColor: tokens.surface2.hex,
      borderLeftColor: tokens.border.hex,
      borderLeftWidth: 3,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginVertical: 4,
    },
    code_inline: {
      color: tokens.textHi.hex,
      backgroundColor: tokens.surface2.hex,
      borderRadius: 4,
      paddingHorizontal: 4,
      fontFamily: MONO,
      fontSize: 13,
    },
    fence: {
      color: tokens.textHi.hex,
      backgroundColor: tokens.surface2.hex,
      borderColor: tokens.borderSubtle.hex,
      borderWidth: 1,
      borderRadius: 8,
      padding: 10,
      marginVertical: 6,
      fontFamily: MONO,
      fontSize: 12.5,
    },
    code_block: {
      color: tokens.textHi.hex,
      backgroundColor: tokens.surface2.hex,
      borderColor: tokens.borderSubtle.hex,
      borderWidth: 1,
      borderRadius: 8,
      padding: 10,
      marginVertical: 6,
      fontFamily: MONO,
      fontSize: 12.5,
    },
    hr: { backgroundColor: tokens.border.hex, height: 1, marginVertical: 8 },
    table: { borderColor: tokens.borderSubtle.hex },
    th: { color: tokens.textHi.hex, padding: 6 },
    td: { color: tokens.textMid.hex, padding: 6 },
  };

  return (
    <Markdown
      style={styles}
      onLinkPress={(url) => {
        Linking.openURL(url).catch(() => {});
        return false;
      }}
    >
      {children}
    </Markdown>
  );
}
