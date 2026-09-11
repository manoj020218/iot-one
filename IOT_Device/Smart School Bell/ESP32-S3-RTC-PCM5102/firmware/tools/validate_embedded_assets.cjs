const fs = require("node:fs");
const path = require("node:path");

const firmwareRoot = path.resolve(__dirname, "..");
const webUiSource = fs.readFileSync(path.join(firmwareRoot, "include", "web_ui.h"), "utf8");
const script = webUiSource.match(/<script>([\s\S]*?)<\/script>/);
if (!script) throw new Error("Embedded WebUI script was not found");
new Function(script[1]);

// Regression guard for the SD browser bug where a visible `/bells` entry could
// not be previewed unless it was also present in the separately loaded sound
// library. A valid browser sound ID must be able to construct its stream URL
// directly, without relying on a refresh or cache hit.
if (!script[1].includes("id.startsWith('bells/')")) {
  throw new Error("SD browser selection has no direct bells/* fallback");
}
if (!script[1].includes("content_url:A+'/sounds/content?path='+encodeURIComponent('/'+id)")) {
  throw new Error("SD browser fallback does not construct a preview content URL");
}
if (script[1].includes("refresh this folder")) {
  throw new Error("SD browser still tells users to refresh instead of resolving the selected path");
}
if (!script[1].includes("manualSoundId=id") ||
    !script[1].includes("let soundId=manualSoundId||testSound.value")) {
  throw new Error("Manual bell does not preserve the exact SD browser selection");
}

const webServiceSource = fs.readFileSync(
  path.join(firmwareRoot, "src", "services", "web_service.cpp"),
  "utf8"
);
const capabilities = webServiceSource.match(/R"JSON\(([\s\S]*?)\)JSON"/);
if (!capabilities) throw new Error("Capabilities JSON was not found");
const contract = JSON.parse(capabilities[1]);
if (!Array.isArray(contract.actions)) throw new Error("Capabilities actions must be an array");

console.log(
  `Embedded WebUI JavaScript and SD preview fallback OK; capabilities API ${contract.api_version}, ${contract.actions.length} actions`
);
