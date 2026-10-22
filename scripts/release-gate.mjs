import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
export const targets = ['darwin-x86_64', 'darwin-aarch64', 'windows-x86_64', 'windows-aarch64', 'linux-x86_64', 'linux-aarch64'];
const required = ['install', 'read', 'search', 'annotate', 'restart', 'backup', 'import', 'rtl', 'accessibility', 'update', 'invalidSignature', 'interruptedDownload', 'dataPreserved'];
export function validateEvidence(evidence, { tag, commit, repository, files, manifest }) {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  assert(evidence.schemaVersion === 1 && evidence.tag === tag && evidence.commit === commit, 'Evidence must match release tag and exact commit');
  for (const key of ['identity', 'contentLicenses', 'macSigningNotarization', 'windowsSigning', 'updaterSigning', 'translationReview']) {
    assert(evidence.gates?.[key]?.passed === true && evidence.gates[key].evidence?.trim(), `Missing release gate: ${key}`);
  }
  assert(['disabled', 'personal'].includes(evidence.diagnostics), 'Specify diagnostics mode');
  if (evidence.diagnostics === 'personal') {
    for (const key of ['personalSentry', 'frontendConsentRedaction', 'rustConsentRedaction']) assert(evidence.gates?.[key]?.passed === true && evidence.gates[key].evidence?.trim(), `Missing diagnostics gate: ${key}`);
  }
  for (const target of targets) {
    const row = evidence.targets?.[target];
    assert(row?.native === true && row?.tester?.trim() && row?.environment?.trim(), `Missing native verification: ${target}`);
    for (const check of required) assert(row.checks?.[check] === true, `${target}: ${check} has not passed`);
    if (target.startsWith('linux')) for (const check of ['x11', 'wayland', 'debianPackage']) assert(row.checks?.[check] === true, `${target}: ${check} has not passed`);
  }
  assert(manifest.version === tag.replace(/^v/, ''), 'Updater manifest version mismatch');
  for (const target of targets) {
    const entry = manifest.platforms?.[target];
    assert(entry?.signature?.trim(), `Missing updater signature: ${target}`);
    const prefix = `https://github.com/${repository}/releases/download/${tag}/`;
    assert(entry.url?.startsWith(prefix), `Unexpected updater URL: ${target}`);
    const name = decodeURIComponent(entry.url.slice(prefix.length));
    assert(name === basename(name) && files[name], `Missing updater artifact: ${target}`);
    const validExtension = target.startsWith('darwin') ? name.endsWith('.app.tar.gz') : target.startsWith('windows') ? name.endsWith('.exe') : /\.AppImage(?:\.tar\.gz)?$/.test(name);
    assert(validExtension, `Incorrect updater artifact type: ${target}`);
    assert(files[`${name}.sig`]?.toString().trim() === entry.signature.trim(), `Updater signature file mismatch: ${target}`);
  }
  for (const [name, bytes] of Object.entries(files)) {
    if (name === 'release-evidence.json') continue;
    assert(evidence.sha256?.[name] === createHash('sha256').update(bytes).digest('hex'), `Unverified or modified release asset: ${name}`);
  }
  assert(Object.keys(files).filter(name => name.endsWith('.dmg')).length >= 2, 'Missing macOS installer');
  assert(Object.keys(files).filter(name => name.endsWith('.deb')).length >= 2, 'Missing Debian installers');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2];
  const files = Object.fromEntries(readdirSync(directory).map(name => [name, readFileSync(resolve(directory, name))]));
  const release = JSON.parse(readFileSync('release.json', 'utf8'));
  if (!release.isDraft || release.tagName !== process.env.RELEASE_TAG) throw new Error('Only an existing matching draft can be published');
  validateEvidence(JSON.parse(files['release-evidence.json']), {
    tag: process.env.RELEASE_TAG,
    commit: readFileSync('release-commit.txt', 'utf8').trim(),
    repository: process.env.RELEASE_REPOSITORY,
    files,
    manifest: JSON.parse(files['latest.json']),
  });
  console.log('All release evidence and asset integrity gates passed.');
}
