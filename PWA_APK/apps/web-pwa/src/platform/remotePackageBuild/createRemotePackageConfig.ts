import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const reactShimPath = path.join(here, "reactHostShim.ts");
const reactRouterDomShimPath = path.join(here, "reactRouterDomHostShim.ts");

export interface RemotePackageConfigOptions {
  /** Absolute path to the package's own vite.config.ts (pass import.meta.url from there). */
  configDir: string;
  /** Package entry file, relative to configDir -- the one that calls host.registerPackage(). */
  entry: string;
  /** Output directory, relative to configDir -- conventionally public/ui-packages/<packageId>/<version>. */
  outDir: string;
  /** Emitted file's basename without extension. Defaults to "remoteEntry" to match devicePackageRegistry.ts's loader. */
  fileName?: string;
}

/**
 * Shared factory for a "remote package" build: one component tree, real
 * TSX + full type-checking, compiled to a single self-registering IIFE
 * script that a device's manifest.json points at (entryPath). React and
 * react-router-dom are aliased to the host-singleton shims in this same
 * folder so the bundle shares the host app's module instances instead of
 * carrying its own copies -- required for hooks/context to work at all
 * once the script is loaded via devicePackageRegistry.ts's <script> tag.
 *
 * Usage (see features/qrunlock/remotePackage/vite.config.ts):
 *
 *   export default createRemotePackageConfig({
 *     configDir: path.dirname(fileURLToPath(import.meta.url)),
 *     entry: "register.ts",
 *     outDir: "../../../../public/ui-packages/qrunlock-mobile/1.0.0"
 *   });
 */
export function createRemotePackageConfig({
  configDir,
  entry,
  outDir,
  fileName = "remoteEntry"
}: RemotePackageConfigOptions): UserConfig {
  return defineConfig({
    // This is a small library build with no HTML entry of its own -- it
    // has no business copying the whole app's public/ directory into its
    // output, and since outDir already lives *inside* public/, letting
    // Vite do that copy recurses into itself indefinitely.
    publicDir: false,
    plugins: [react()],
    resolve: {
      alias: [
        // Anchored regexes on purpose: a plain string key aliases by
        // prefix in Vite (like webpack), which would also redirect
        // "react/jsx-runtime" here and break the JSX transform's own
        // (harmless, tiny, unrelated-to-hooks) internal "react" import.
        { find: /^react$/, replacement: reactShimPath },
        { find: /^react-router-dom$/, replacement: reactRouterDomShimPath }
      ]
    },
    build: {
      outDir: path.resolve(configDir, outDir),
      emptyOutDir: false,
      cssCodeSplit: false,
      minify: true,
      lib: {
        entry: path.resolve(configDir, entry),
        formats: ["iife"],
        name: "__jenixRemotePackageEntry",
        fileName: () => `${fileName}.js`
      }
    }
  });
}
