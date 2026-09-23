// Deliberately not exported through @jenix/shared -- nothing outside this
// backend module needs it, and packages/shared's gitignored, must-be-rebuilt
// dist/ has already caused two production incidents (see root HANDOFF.md
// §3) for changes far more load-bearing than a device-enrollment response
// shape only this module's own controller/service touch.
export interface DeviceCloudConfigResponse {
  homeId: string;
  mqttHost: string;
  mqttPort: number;
  mqttUsername: string;
  mqttPassword: string;
}
