# Dependency audit — August 13, 2026

## Scope

This review covers newly published high-severity advisories in the pinned Expo 54 and React Native
0.81 toolchain. The model-cost indicator feature adds no dependency.

## Resolved advisories

Exact compatible resolutions now prevent the vulnerable versions of `brace-expansion`, `fast-uri`,
`js-yaml`, `nanoid`, `postcss`, and `undici` from entering the lockfile. Every replacement version
was verified against the official npm registry before installation.

## Temporary upstream exception

Two `image-size` denial-of-service advisories remain:

- `GHSA-w3rx-r6r6-pgpr` for the ICNS parser;
- `GHSA-5p2g-fcmc-qvqq` for the JXL and HEIF parsers.

The npm advisory currently marks every published `image-size` release through `2.0.2` as affected.
No patched package version exists. The package reaches DevinX only through Metro inside the pinned
Expo and React Native build toolchain. It is not imported by application code, and the macOS and
Windows Connector builders now fail if `image-size` enters their esbuild runtime bundle.

The audit gate still runs the complete npm audit. It permits only the two exact advisory source
IDs, package name, severity, URL, and affected range above; any changed or additional high/critical
advisory fails CI. The exception expires on September 30, 2026 so the upstream state must be reviewed
again. A forced Expo 57 migration is not accepted as a release-hotfix because it would change the
native SDK and require a separate full device-compatibility cycle.

## Verification

- clean exact-lock install on pinned Node 24.18.0;
- dependency-tree inspection;
- full lint, strict TypeScript, Jest, app build, and Connector build suites;
- macOS and Windows Connector bundle provenance checks;
- full npm audit with only the two exact, time-bounded toolchain advisories accepted.
