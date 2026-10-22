import { readFileSync, writeFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
if (process.env.RELEASE_TAG !== `v${pkg.version}` || config.version !== pkg.version) throw new Error('Tag/package/Tauri versions must match');
for (const key of ['PLATFORM_KEY', 'UPDATER_KEY', 'RELEASE_CONFIG']) {
  if (!process.env[key]?.trim()) throw new Error(`Missing release configuration: ${key}`);
}
const overrides = JSON.parse(process.env.RELEASE_CONFIG);
if (overrides.bundle?.createUpdaterArtifacts !== true || !overrides.plugins?.updater?.pubkey || !overrides.plugins?.updater?.endpoints?.length) throw new Error('Release override must enable signed updater artifacts and configure public key/endpoints');
if (!overrides.plugins.updater.endpoints.every(url => url.startsWith('https://'))) throw new Error('Updater endpoints must use HTTPS');
writeFileSync('release-config.json', JSON.stringify(overrides));
