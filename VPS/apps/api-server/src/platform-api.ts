/**
 * The internal API surface product-specific packages outside this app
 * (e.g. IOT_Device/Smart IP speaker/backend) are allowed to depend on.
 * Kept deliberately small - everything here is re-exported as-is, with
 * no new logic. If a product package needs something not listed here,
 * add it here explicitly rather than having that package reach into
 * api-server module files directly.
 */
export {
  requireAuthenticatedUser,
  requireAuthenticatedRequestUser,
  readHomeIdFromRequest
} from "./infrastructure/http/request-auth";
export { listDevices, getDevice, dispatchDeviceUiCommand } from "./modules/devices/device.service";
export {
  createScene,
  patchScene,
  deleteScene,
  listScenes,
  runSceneManually
} from "./modules/scenes/scene.service";
