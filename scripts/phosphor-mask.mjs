// Prints CSS mask tokens for Phosphor light icons: node scripts/phosphor-mask.mjs MagnifyingGlass:--icon-search
import { readFileSync } from "node:fs";

for (const spec of process.argv.slice(2)) {
  const [name, property] = spec.split(":");
  const source = readFileSync(
    `node_modules/@phosphor-icons/react/dist/defs/${name}.es.js`,
    "utf8",
  );
  const path = source.match(/"light",[\s\S]*?d: "([^"]+)"/)[1];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'><path d='${path}'/></svg>`;
  const encoded = encodeURIComponent(svg).replace(/%(20|3D|3A|2F|2C)/g, (m) =>
    decodeURIComponent(m),
  );
  console.log(`  ${property}: url("data:image/svg+xml,${encoded}");`);
}
