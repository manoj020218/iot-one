import { mkdirSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const outDir = "dist";
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: ["src/index.tsx"],
  bundle: true,
  format: "iife",
  target: "es2019",
  outfile: `${outDir}/remoteEntry.js`,
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  legalComments: "none",
  minify: process.argv.includes("--minify")
});

writeFileSync(
  `${outDir}/manifest.json`,
  `${JSON.stringify(
    {
      packageId: "smart-streamer-plugin",
      version: "1.0.0",
      entryPath: "/ui-packages/smart-streamer-plugin/1.0.0/remoteEntry.js",
      exportName: "SmartStreamerApp",
      templateId: "smart-streamer-plugin-v1",
      dynamicPages: [],
      capabilities: {
        runtime: ["session", "home"],
        commands: []
      }
    },
    null,
    2
  )}\n`
);

console.log("Built dist/remoteEntry.js and dist/manifest.json");
