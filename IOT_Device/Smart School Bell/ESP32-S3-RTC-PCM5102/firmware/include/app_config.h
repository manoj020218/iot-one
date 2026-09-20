#pragma once

#include <cstdint>

namespace app::config {

inline constexpr char kAppName[] = "Jenix SchoolBell Firmware";
inline constexpr char kAppTag[] = "JenixBell";
inline constexpr char kFirmwareVersion[] = "0.6.2-sd-stat-fix";
inline constexpr char kProductId[] = "JNX-SB-S3-001";
inline constexpr char kDeviceIdPrefix[] = "JNX-SB-S3";
inline constexpr char kMdnsPrefix[] = "jnx-sb";
inline constexpr char kInternalPartitionLabel[] = "internal";
inline constexpr char kInternalMountPoint[] = "/flash";
inline constexpr char kSdMountPoint[] = "/sdcard";
inline constexpr char kDeviceConfigPath[] = "/flash/device.json";
inline constexpr char kSchedulesPath[] = "/flash/schedules.json";
inline constexpr char kScheduleProfilesPath[] = "/flash/schedule_profiles.json";
inline constexpr char kHolidaysPath[] = "/flash/holidays.json";
inline constexpr char kBellPresetsPath[] = "/flash/bell_presets.json";
inline constexpr char kSoundsManifestPath[] = "/flash/sounds_manifest.json";
inline constexpr char kRuntimeLogPath[] = "/flash/logs/runtime.log";
inline constexpr char kFestivalDirectory[] = "/flash/festival";
inline constexpr char kTimezonePosixDefault[] = "IST-5:30";
inline constexpr char kApiVersion[] = "1.4";
inline constexpr char kSetupApSsid[] = "JENIX-SCHOOL-BELL";
inline constexpr char kSetupApPassword[] = "JenixBell@123";
inline constexpr char kDefaultMqttHost[] = "mqtt.iotsoft.in";
inline constexpr uint16_t kDefaultMqttPort = 1883;

inline constexpr uint32_t kMainLoopIntervalMs = 1000;
inline constexpr uint32_t kShortPressMinMs = 50;
inline constexpr uint32_t kLongPressMinMs = 3000;
inline constexpr uint32_t kFactoryResetMinMs = 30000;
inline constexpr uint32_t kButtonReleaseGraceMs = 1500;
inline constexpr uint32_t kRecoveryGraceWindowSeconds = 120;
inline constexpr uint32_t kDefaultBellDurationSeconds = 5;
inline constexpr uint32_t kMaxBellDurationSeconds = 3600;
inline constexpr uint8_t kDefaultVolumePercent = 80;
inline constexpr uint16_t kHttpPort = 80;
inline constexpr uint32_t kWebServerStackSize = 24576;
inline constexpr uint32_t kMaxRingRequestBytes = 1024;
inline constexpr uint32_t kMaxConfigRequestBytes = 4096;
inline constexpr uint32_t kMaxScheduleRequestBytes = 64 * 1024;
inline constexpr uint32_t kMaxBellDataRequestBytes = 128 * 1024;
inline constexpr uint32_t kMaxAudioUploadBytes = 64 * 1024 * 1024;
inline constexpr uint32_t kCanonicalSampleRate = 22050;
inline constexpr uint8_t kCanonicalBitsPerSample = 16;
inline constexpr uint8_t kCanonicalChannels = 1;
inline constexpr uint32_t kAudioChunkSamples = 512;
inline constexpr uint32_t kAudioHttpReadBytes = kAudioChunkSamples * sizeof(int16_t);
inline constexpr uint32_t kWaveHeaderProbeBytes = 4096;
inline constexpr uint32_t kAudioHttpTimeoutMs = 8000;
inline constexpr uint32_t kAnnouncementSampleRate = 22050;
inline constexpr uint32_t kAnnouncementAdcFrameSamples = 256;
inline constexpr uint32_t kAnnouncementAdcPoolBytes = 4096;
inline constexpr uint32_t kAnnouncementPttDebounceMs = 30;
inline constexpr uint32_t kAnnouncementTaskStackBytes = 6144;
inline constexpr uint32_t kSoftAnnouncementMaxFrameBytes = 4096;
inline constexpr uint32_t kSoftAnnouncementIdleTimeoutMs = 750;
inline constexpr uint16_t kAnnouncementDefaultGainPercent = 200;
inline constexpr uint16_t kAnnouncementMaxGainPercent = 800;
inline constexpr uint32_t kWifiConnectTimeoutMs = 15000;
inline constexpr uint32_t kStatusLedTickMs = 100;
inline constexpr uint32_t kRtcMinValidYear = 2024;
inline constexpr uint32_t kRtcMaxValidYear = 2099;
inline constexpr uint32_t kDiagToneHz = 880;
inline constexpr uint32_t kDiagToneMs = 400;
inline constexpr uint32_t kCloudStatusIntervalMs = 30000;
inline constexpr uint32_t kOtaRebootDelayMs = 2000;

}  // namespace app::config
