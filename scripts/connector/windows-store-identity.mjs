import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(scriptDirectory, '..', '..');
export const storePackagingRoot = resolve(repositoryRoot, 'connector', 'windows-msix');
export const storeIdentityPath = resolve(storePackagingRoot, 'store-identity.json');
export const storeManifestTemplatePath = resolve(
  storePackagingRoot,
  'AppxManifest.xml.template',
);

const expectedIdentity = Object.freeze({
  storeId: '9N52Z3FVMFH8',
  identityName: 'DevinXTools.DevinXConnector',
  publisher: 'CN=43D84E24-857C-4C40-9DAA-1A6983913CD9',
  publisherDisplayName: 'DevinX Tools',
  packageFamilyName: 'DevinXTools.DevinXConnector_ydtgrt4yd5wrc',
  msaAppId: '7d1237e7-6265-48ab-adf5-2a12f5d81101',
  version: '0.1.1.0',
  architecture: 'x64',
  defaultLanguage: 'en-US',
  minimumWindowsVersion: '10.0.22000.0',
  maximumWindowsVersionTested: '10.0.26100.0',
});

export function loadStoreIdentity() {
  const value = JSON.parse(readFileSync(storeIdentityPath, 'utf8'));
  for (const [key, expected] of Object.entries(expectedIdentity)) {
    if (value[key] !== expected) {
      throw new Error(`Microsoft Store identity mismatch for ${key}`);
    }
  }
  if (Object.keys(value).length !== Object.keys(expectedIdentity).length) {
    throw new Error('Microsoft Store identity contains an unsupported field');
  }
  return Object.freeze(value);
}

function xmlEscape(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function renderStoreManifest(identity = loadStoreIdentity()) {
  const replacements = {
    IDENTITY_NAME: identity.identityName,
    PUBLISHER: identity.publisher,
    VERSION: identity.version,
    ARCHITECTURE: identity.architecture,
    PUBLISHER_DISPLAY_NAME: identity.publisherDisplayName,
    DEFAULT_LANGUAGE: identity.defaultLanguage,
    MINIMUM_WINDOWS_VERSION: identity.minimumWindowsVersion,
    MAXIMUM_WINDOWS_VERSION_TESTED: identity.maximumWindowsVersionTested,
  };
  let manifest = readFileSync(storeManifestTemplatePath, 'utf8');
  for (const [token, value] of Object.entries(replacements)) {
    manifest = manifest.replaceAll(`{{${token}}}`, xmlEscape(value));
  }
  if (manifest.includes('{{')) {
    throw new Error('Microsoft Store manifest contains an unresolved template token');
  }
  return manifest;
}

export function storeArtifactName(identity = loadStoreIdentity()) {
  return `DevinX-Connector-${identity.version}-windows-${identity.architecture}.msix`;
}

export function findMakeAppx() {
  const explicit = process.env.DEVINX_MAKEAPPX_PATH;
  if (explicit && existsSync(explicit)) return explicit;

  const located = spawnSync('where.exe', ['MakeAppx.exe'], {
    encoding: 'utf8',
    shell: false,
  });
  if (located.status === 0) {
    const first = located.stdout
      .split(/\r?\n/)
      .map((value) => value.trim())
      .find(Boolean);
    if (first && existsSync(first)) return first;
  }

  const programFilesX86 = process.env['ProgramFiles(x86)'];
  if (programFilesX86) {
    const kitsBin = resolve(programFilesX86, 'Windows Kits', '10', 'bin');
    if (existsSync(kitsBin)) {
      const versions = readdirSync(kitsBin)
        .filter((entry) => /^\d+\.\d+\.\d+\.\d+$/.test(entry))
        .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
      for (const version of versions) {
        const candidate = resolve(kitsBin, version, 'x64', 'MakeAppx.exe');
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  throw new Error('MakeAppx.exe was not found. Install the Windows 11 SDK.');
}
