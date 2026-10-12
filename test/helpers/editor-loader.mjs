// Lets tests import the web editor's TypeScript modules directly: Node strips
// the types, "@hlr/*" resolves to the built library, and extensionless
// relative imports find their .ts files.
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@hlr/"))
      return next(new URL(`dist/${specifier.slice(5)}`, root).href, context);
    if (
      specifier.startsWith(".") &&
      context.parentURL?.includes("/web/src/") &&
      !/\.[cm]?[jt]sx?$/.test(specifier)
    )
      for (const ext of [".ts", ".tsx"]) {
        const url = new URL(specifier + ext, context.parentURL);
        if (existsSync(fileURLToPath(url))) return next(url.href, context);
      }
    return next(specifier, context);
  },
});
