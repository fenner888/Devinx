# Dependency audit — 2026-07-15

## Result

The four moderate GitHub Dependabot alerts present on `main` were resolved without changing the
Expo SDK or adding a new dependency. `npm audit --audit-level=low` now reports zero vulnerabilities.

GitHub grouped the findings into four advisories. npm expanded those advisories through 21 affected
dependency paths because the vulnerable packages were transitive dependencies of Expo tooling and
the React Native markdown renderer.

## Findings and remediation

| Package       | Advisory                                                                 |        Previous | Resolution |
| ------------- | ------------------------------------------------------------------------ | --------------: | ---------: |
| `markdown-it` | [GHSA-6vfc-qv3f-vr6c](https://github.com/advisories/GHSA-6vfc-qv3f-vr6c) |        `10.0.0` |   `14.3.0` |
| `markdown-it` | [GHSA-6v5v-wf23-fmfq](https://github.com/advisories/GHSA-6v5v-wf23-fmfq) |        `10.0.0` |   `14.3.0` |
| `postcss`     | [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) | nested `8.4.49` |   `8.5.19` |
| `uuid`        | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) |         `7.0.3` |   `11.1.1` |

Exact root and transitive overrides prevent the lockfile from resolving a vulnerable version. The
root `postcss` development dependency was also updated to the same exact safe version.

## Package verification

The packages and versions were verified against the official npm registry before the lockfile was
updated.

| Package       | Official repository                                                   | Registry status                  | Downloads in the preceding 30 days |
| ------------- | --------------------------------------------------------------------- | -------------------------------- | ---------------------------------: |
| `markdown-it` | [markdown-it/markdown-it](https://github.com/markdown-it/markdown-it) | `14.3.0` current on 2026-07-15   |                        108,034,185 |
| `postcss`     | [postcss/postcss](https://github.com/postcss/postcss)                 | `8.5.19` current on 2026-07-15   |                      1,058,204,337 |
| `uuid`        | [uuidjs/uuid](https://github.com/uuidjs/uuid)                         | `11.1.1` supported CommonJS line |                      1,135,857,967 |

`react-native-markdown-display 7.0.2` remains the direct renderer dependency. Its registry package,
MIT license, and source repository at
[iamacup/react-native-markdown-display](https://github.com/iamacup/react-native-markdown-display)
were also verified. The package had 3,639,873 downloads during the same 30-day window.

## Compatibility decision

`npm audit` suggested Expo 57 as an automatic fix because several affected paths originated under
Expo tooling. DevinX is pinned to Expo 54 and React Native 0.81.5. A major Expo migration immediately
before release would expand the native and physical-device test surface unnecessarily, so the audit
used exact compatible transitive resolutions instead.

- `markdown-it 14.3.0` preserves the parser API used by `react-native-markdown-display`.
- `postcss 8.5.19` satisfies the tooling interfaces used by Expo and Tailwind.
- `uuid 11.1.1` is the maintained CommonJS-compatible line required by the `xcode` package.

## Verification

All checks ran with the repository's pinned Node.js `24.18.0` runtime.

- clean `npm ci --legacy-peer-deps`
- resolved-tree inspection with `npm ls`
- targeted `DevinMarkdown` renderer and media-safety suite: 8 tests passed
- complete `npm run ci`: 80 suites and 575 tests passed
- app and Connector TypeScript builds passed
- `npm audit --audit-level=low`: zero vulnerabilities
- `git diff --check`: passed

The install still emits deprecation notices for older tooling packages, including ESLint 8 and
Glob 7. Those packages are not currently reported as vulnerable by npm. Their eventual replacement
belongs in a separately tested tooling or Expo migration rather than this focused security update.
