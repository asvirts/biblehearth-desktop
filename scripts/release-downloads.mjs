import { pathToFileURL } from 'node:url';

export const platforms = [
  { target: 'aarch64-apple-darwin', slug: 'macOS_Apple-Silicon', label: 'macOS — Apple Silicon', device: 'Mac with an Apple M-series chip', extensions: ['.dmg'] },
  { target: 'x86_64-apple-darwin', slug: 'macOS_Intel', label: 'macOS — Intel', device: 'Mac with an Intel processor', extensions: ['.dmg'] },
  { target: 'x86_64-pc-windows-msvc', slug: 'Windows_x64', label: 'Windows — Intel / AMD 64-bit (x64)', device: 'Most Windows PCs with Intel or AMD processors', extensions: ['.exe'] },
  { target: 'aarch64-pc-windows-msvc', slug: 'Windows_ARM64', label: 'Windows — ARM64', device: 'Windows on ARM, including Snapdragon PCs', extensions: ['.exe'] },
  { target: 'x86_64-unknown-linux-gnu', slug: 'Linux_x64', label: 'Linux — Intel / AMD 64-bit (x64)', device: 'Linux PCs with Intel or AMD processors', extensions: ['.AppImage', '.deb'] },
  { target: 'aarch64-unknown-linux-gnu', slug: 'Linux_ARM64', label: 'Linux — ARM64', device: 'Linux systems with 64-bit ARM processors', extensions: ['.AppImage', '.deb'] },
];

export function installerAsset(tag, target, extension) {
  if (!/^v\d+\.\d+\.\d+-alpha\.\d+$/.test(tag)) throw new Error('Expected a versioned alpha tag');
  const platform = platforms.find(platform => platform.target === target);
  if (!platform?.extensions.includes(extension)) throw new Error('Unsupported platform or installer format');
  const format = { '.dmg': 'DMG installer', '.exe': 'EXE installer', '.AppImage': 'AppImage', '.deb': 'Debian / Ubuntu package' }[extension];
  return { name: `BibleHearth_${tag.slice(1)}_${platform.slug}${extension}`, label: `${platform.label} — ${format}` };
}

export function downloadTable(tag, repository) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Expected owner/repository');
  const rows = platforms.map(platform => {
    const links = platform.extensions.map(extension => {
      const asset = installerAsset(tag, platform.target, extension);
      const format = extension === '.AppImage' ? 'AppImage' : extension.slice(1).toUpperCase();
      return `[${format}](https://github.com/${repository}/releases/download/${tag}/${asset.name})`;
    });
    return `| ${platform.label} | ${platform.device} | ${links.join(' · ')} |`;
  });
  return `## Choose your download\n\n| Platform | Choose this for | Download |\n| --- | --- | --- |\n${rows.join('\n')}\n\nOn a Mac, check **Apple menu → About This Mac**: “Chip” means Apple Silicon; “Processor: Intel” means Intel. On Windows, check **Settings → System → About → System type** for x64 or ARM64. Linux users can run \`uname -m\`: \`x86_64\` means x64; \`aarch64\` means ARM64.\n\nUse the **DEB** package on Debian/Ubuntu, or **AppImage** on compatible Linux distributions. GitHub’s “Source code” archives are for developers and do not install the app.\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(downloadTable(process.argv[2], process.argv[3]));
}
