# Dependency audit — July 24, 2026

## Scope

This review covers the newly published `brace-expansion` denial-of-service advisory
[`GHSA-mh99-v99m-4gvg`](https://github.com/advisories/GHSA-mh99-v99m-4gvg) and its effect on the
DevinX release gates.

## Finding

`npm audit` reports 45 high-severity entries, but every entry resolves to the same advisory through
Expo, React Native, Jest, ESLint, Glob, or related build/test tooling. The application does not
accept user-controlled brace patterns for those tools. The signed Connector runtime is produced as
an esbuild bundle, and both the macOS and Windows build scripts now fail if either `brace-expansion`
or `minimatch` enters that runtime bundle.

The patched `brace-expansion` major version cannot be forced across the current dependency graph:
a blanket override makes the pinned ESLint stack fail at startup with `expand is not a function`.
`npm audit fix --force` proposes incompatible major downgrades/upgrades of the pinned Expo, React
Native, Jest, and ESLint stack. Neither option is a safe release change.

## Fail-closed treatment

`scripts/security/npm-audit-gate.mjs` continues to run the full npm audit and fail on every
high/critical advisory except the exact advisory identity, URL, range, source ID, and severity of
`GHSA-mh99-v99m-4gvg`. It recursively validates every reported dependency chain, so a second
advisory or changed advisory record fails CI. The exception expires on August 8, 2026 and must then
be removed or explicitly re-reviewed.

This is a temporary upstream-compatibility exception, not a general reduction of the dependency
security gate.
