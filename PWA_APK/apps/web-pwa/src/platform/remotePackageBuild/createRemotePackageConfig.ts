import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const reactShimPath = path.join(here, "reactHostShim.ts");
const reactJsxRuntimeShimPath = path.join(here, "reactJsxRuntimeHostShim.ts");
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
    // Vite's normal app build (vite.config.ts at the project root) defines
    // process.env.NODE_ENV itself as part of its standard mode handling.
    // This is a standalone lib build with no "mode" of its own, so without
    // this the real (unaliased -- see the react-router-dom alias comment
    // below) react/jsx-runtime package's own `process.env.NODE_ENV` check
    // ships as a literal, unreplaced reference -- there's no `process`
    // global in a browser, so it throws at script load.
    define: {
      "process.env.NODE_ENV": JSON.stringify("production")
    },
    plugins: [react()],
    resolve: {
      alias: [
        // Anchored regexes on purpose: a plain string key aliases by
        // prefix in Vite (like webpack), which would silently swallow
        // "react/jsx-runtime" into the "react" alias target too.
        { find: /^react$/, replacement: reactShimPath },
        // The real npm "react/jsx-runtime" reads React's internal
        // __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED shape, which
        // reactHostShim.ts doesn't replicate -- aliased to its own shim
        // (implemented on top of createElement) instead of bundling the
        // real thing. See reactJsxRuntimeHostShim.ts.
        { find: /^react\/jsx-runtime$/, replacement: reactJsxRuntimeShimPath },
        { find: /^react\/jsx-dev-runtime$/, replacement: reactJsxRuntimeShimPath },
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
