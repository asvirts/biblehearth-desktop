import test from 'node:test';
import assert from 'node:assert/strict';
import { platforms, installerAsset, downloadTable } from './release-downloads.mjs';

test('all six platforms produce eight distinct, clearly labeled installers', () => {
  const assets = platforms.flatMap(platform => platform.extensions.map(extension => installerAsset('v0.1.0-alpha.4', platform.target, extension)));
  assert.equal(platforms.length, 6);
  assert.equal(new Set(assets.map(asset => asset.name)).size, 8);
  assert.equal(assets[0].name, 'BibleHearth_0.1.0-alpha.4_macOS_Apple-Silicon.dmg');
  assert.match(assets[2].label, /Windows.*Intel.*AMD.*x64.*EXE/);
  assert.match(assets[3].name, /Windows_ARM64\.exe$/);
  assert.ok(assets.every(asset => !asset.label.includes('#')));
});

test('download table links to exactly the generated installer names', () => {
  const table = downloadTable('v0.1.0-alpha.4', 'asvirts/biblehearth-desktop');
  for (const platform of platforms) {
    for (const extension of platform.extensions) {
      const { name } = installerAsset('v0.1.0-alpha.4', platform.target, extension);
      assert.ok(table.includes(`/releases/download/v0.1.0-alpha.4/${name})`));
    }
  }
  assert.equal((table.match(/https:\/\/github.com\//g) || []).length, 8);
});

test('invalid tags, targets, formats, and repository names are rejected', () => {
  assert.throws(() => installerAsset('v0.1.0', platforms[0].target, '.dmg'));
  assert.throws(() => installerAsset('v0.1.0-alpha.4', '../unknown', '.dmg'));
  assert.throws(() => installerAsset('v0.1.0-alpha.4', platforms[0].target, '.exe'));
  assert.throws(() => downloadTable('v0.1.0-alpha.4', 'https://example.com'));
});
