import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateEvidence, targets } from './release-gate.mjs';
function fixture() {
  const gates = Object.fromEntries(['identity', 'contentLicenses', 'macSigningNotarization', 'windowsSigning', 'updaterSigning', 'personalSentry', 'frontendConsentRedaction', 'rustConsentRedaction', 'translationReview'].map(key => [key, { passed: true, evidence: 'test receipt' }]));
  const checks = Object.fromEntries(['install', 'read', 'search', 'annotate', 'restart', 'backup', 'import', 'rtl', 'accessibility', 'update', 'invalidSignature', 'interruptedDownload', 'dataPreserved', 'x11', 'wayland', 'debianPackage'].map(key => [key, true]));
  const files = { 'app.dmg': Buffer.from('test'), 'arm.dmg': Buffer.from('test'), 'x64.deb': Buffer.from('test'), 'arm64.deb': Buffer.from('test') };
  const platforms = Object.fromEntries(targets.map(target => {
    const name=target+(target.startsWith('darwin')?'.app.tar.gz':target.startsWith('windows')?'.exe':'.AppImage');
    files[name] = Buffer.from('test artifact'); files[`${name}.sig`] = Buffer.from('test signature');
    return [target, { signature: 'test signature', url: `https://github.com/owner/repo/releases/download/v1.0.0/${name}` }];
  }));
  const evidence = { schemaVersion: 1, diagnostics: 'disabled', tag: 'v1.0.0', commit: 'abc', gates, targets: Object.fromEntries(targets.map(target => [target, { native: true, tester: 'tester', environment: 'native test machine', checks: { ...checks } }])), sha256: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])) };
  return { evidence, context: { tag: 'v1.0.0', commit: 'abc', repository: 'owner/repo', files, manifest: { version: '1.0.0', platforms } } };
}
test('accepts complete matching evidence', () => { const f = fixture(); assert.doesNotThrow(() => validateEvidence(f.evidence, f.context)); });
test('rejects missing native ARM verification', () => { const f = fixture(); delete f.evidence.targets['windows-aarch64']; assert.throws(() => validateEvidence(f.evidence, f.context), /native verification/); });
test('rejects altered artifact after verification', () => { const f = fixture(); f.context.files['app.dmg'] = Buffer.from('changed'); assert.throws(() => validateEvidence(f.evidence, f.context), /modified release asset/); });
test('rejects evidence for a different commit', () => { const f = fixture(); f.context.commit = 'other'; assert.throws(() => validateEvidence(f.evidence, f.context), /exact commit/); });
test('rejects updater signature mismatch', () => { const f = fixture(); f.context.manifest.platforms['linux-aarch64'].signature = 'wrong'; assert.throws(() => validateEvidence(f.evidence, f.context), /signature file mismatch/); });

test('requires consent receipts when diagnostics are enabled', () => { const f = fixture(); f.evidence.diagnostics = 'personal'; delete f.evidence.gates.personalSentry; assert.throws(() => validateEvidence(f.evidence, f.context), /diagnostics gate/); });
