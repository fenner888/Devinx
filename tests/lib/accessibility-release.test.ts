import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const sourceRoot = resolve(__dirname, '..', '..', 'src');
const interactiveNames = new Set(['Pressable', 'TouchableOpacity', 'TouchableHighlight']);

function tsxFiles(directory: string, output: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) tsxFiles(path, output);
    else if (entry.name.endsWith('.tsx')) output.push(path);
  }
  return output;
}

function hasAttribute(
  attributes: ts.JsxAttributes,
  sourceFile: ts.SourceFile,
  name: string,
): boolean {
  return attributes.properties.some(
    (attribute) =>
      ts.isJsxAttribute(attribute) && attribute.name.getText(sourceFile) === name,
  );
}

function hasTextChild(element: ts.JsxElement, sourceFile: ts.SourceFile): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(sourceFile) === 'Text') {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  element.children.forEach(visit);
  return found;
}

describe('release accessibility semantics', () => {
  it('gives every icon-only interactive control an explicit label', () => {
    const violations: string[] = [];

    for (const file of tsxFiles(sourceRoot)) {
      const source = readFileSync(file, 'utf8');
      const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node) => {
        if (ts.isJsxSelfClosingElement(node)) {
          const name = node.tagName.getText(sourceFile);
          if (
            interactiveNames.has(name) &&
            !hasAttribute(node.attributes, sourceFile, 'accessibilityLabel')
          ) {
            const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
            violations.push(`${file}:${position.line + 1}`);
          }
        }
        if (ts.isJsxElement(node)) {
          const name = node.openingElement.tagName.getText(sourceFile);
          if (
            interactiveNames.has(name) &&
            !hasAttribute(node.openingElement.attributes, sourceFile, 'accessibilityLabel') &&
            !hasTextChild(node, sourceFile)
          ) {
            const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
            violations.push(`${file}:${position.line + 1}`);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
    }

    expect(violations).toEqual([]);
  });
});
