import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function normalize(text) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}.+-]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function editCounts(reference, hypothesis) {
  const rows = Array.from({ length: reference.length + 1 }, () => []);
  rows[0][0] = { cost: 0, substitutions: 0, deletions: 0, insertions: 0 };
  for (let i = 1; i <= reference.length; i++) {
    rows[i][0] = { cost: i, substitutions: 0, deletions: i, insertions: 0 };
  }
  for (let j = 1; j <= hypothesis.length; j++) {
    rows[0][j] = { cost: j, substitutions: 0, deletions: 0, insertions: j };
  }
  for (let i = 1; i <= reference.length; i++) {
    for (let j = 1; j <= hypothesis.length; j++) {
      if (reference[i - 1] === hypothesis[j - 1]) {
        rows[i][j] = { ...rows[i - 1][j - 1] };
        continue;
      }
      const candidates = [
        { ...rows[i - 1][j - 1], substitutions: rows[i - 1][j - 1].substitutions + 1 },
        { ...rows[i - 1][j], deletions: rows[i - 1][j].deletions + 1 },
        { ...rows[i][j - 1], insertions: rows[i][j - 1].insertions + 1 },
      ].map((entry) => ({ ...entry, cost: entry.substitutions + entry.deletions + entry.insertions }));
      rows[i][j] = candidates.sort((a, b) => a.cost - b.cost)[0];
    }
  }
  return rows[reference.length][hypothesis.length];
}

const [, , referencePath, hypothesisPath] = process.argv;
if (!referencePath || !hypothesisPath) {
  console.error('Usage: node score-wer.mjs <reference.txt> <hypothesis.txt>');
  process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const [referenceText, hypothesisText, manifestText] = await Promise.all([
  readFile(resolve(referencePath), 'utf8'),
  readFile(resolve(hypothesisPath), 'utf8'),
  readFile(resolve(here, 'manifest.json'), 'utf8'),
]);
const reference = normalize(referenceText);
const hypothesis = normalize(hypothesisText);
const counts = editCounts(reference, hypothesis);
const manifest = JSON.parse(manifestText);
const normalizedReference = ` ${reference.join(' ')} `;
const normalizedHypothesis = ` ${hypothesis.join(' ')} `;
const missedTerms = manifest.technical_terms.filter((term) => {
  const normalizedTerm = normalize(term).join(' ');
  return normalizedReference.includes(` ${normalizedTerm} `)
    && !normalizedHypothesis.includes(` ${normalizedTerm} `);
});

console.log(JSON.stringify({
  reference_words: reference.length,
  hypothesis_words: hypothesis.length,
  substitutions: counts.substitutions,
  deletions: counts.deletions,
  insertions: counts.insertions,
  word_error_rate: reference.length === 0 ? null : Number((counts.cost / reference.length).toFixed(4)),
  missed_technical_terms: missedTerms,
}, null, 2));
