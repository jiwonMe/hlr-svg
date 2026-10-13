// Bundles the library into one dependency-free ES module inside the agent
// skill, so an installed skill folder renders without `npm install`.
//
//   node scripts/build-skill.mjs          write skills/hlr-svg/scripts/hlr.mjs
//   node scripts/build-skill.mjs --check  fail if the committed bundle is stale

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "skills/hlr-svg/scripts/hlr.mjs");
const check = process.argv.includes("--check");

async function bundle() {
  const outDir = await mkdtemp(join(tmpdir(), "hlr-skill-"));
  try {
    await build({
      configFile: false,
      logLevel: "warn",
      root,
      build: {
        outDir,
        emptyOutDir: true,
        minify: false,
        reportCompressedSize: false,
        target: "es2022",
        lib: {
          entry: join(root, "src/index.ts"),
          formats: ["es"],
          fileName: () => "hlr.mjs",
        },
      },
    });
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    const body = await readFile(join(outDir, "hlr.mjs"), "utf8");
    return (
      `// hlr ${pkg.version}: bundled from src/ by scripts/build-skill.mjs. Do not edit.\n` +
      `// MIT License, https://github.com/jiwonMe/hlr-svg\n` +
      body
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

const fresh = await bundle();
if (check) {
  const current = await readFile(target, "utf8").catch(() => "");
  if (current !== fresh) {
    console.error(
      "skills/hlr-svg/scripts/hlr.mjs is out of date. Run `pnpm skill:build`.",
    );
    process.exit(1);
  }
  console.log("skill bundle is up to date");
} else {
  await writeFile(target, fresh);
  console.log(`wrote ${target.slice(root.length + 1)}`);
}
