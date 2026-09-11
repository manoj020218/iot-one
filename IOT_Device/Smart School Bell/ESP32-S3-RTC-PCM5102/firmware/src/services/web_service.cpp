#include "services/web_service.h"

#include <algorithm>
#include <cctype>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <dirent.h>
#include <string>
#include <sys/stat.h>
#include <unordered_map>
#include <vector>

#include "app_config.h"
#include "board_pins.h"
#include "cJSON.h"
#include "esp_check.h"
#include "esp_log.h"
#include "services/audio_service.h"
#include "services/config_service.h"
#include "services/cloud_service.h"
#include "services/holiday_service.h"
#include "services/log_service.h"
#include "services/media_metadata.h"
#include "services/schedule_service.h"
#include "services/storage_service.h"
#include "services/time_service.h"
#include "services/wifi_service.h"
#include "utils/file_utils.h"
#include "web_ui.h"

namespace app::services {

namespace {
constexpr char kTag[] = "WebService";

struct MediaDurationCacheEntry {
  off_t bytes = 0;
  time_t modified = 0;
  uint64_t duration_ms = 0;
  bool valid = false;
};

bool cachedMediaDuration(const std::string& path, const std::string& extension,
                         const struct stat& info, uint64_t* duration_ms) {
  static std::unordered_map<std::string, MediaDurationCacheEntry> cache;
  const auto found = cache.find(path);
  if (found != cache.end() && found->second.bytes == info.st_size &&
      found->second.modified == info.st_mtime) {
    if (duration_ms != nullptr) *duration_ms = found->second.duration_ms;
    return found->second.valid;
  }
  uint64_t measured = 0;
  const bool valid = readMediaDurationMs(path, extension, &measured) == ESP_OK;
  cache[path] = MediaDurationCacheEntry{info.st_size, info.st_mtime, measured, valid};
  if (duration_ms != nullptr) *duration_ms = measured;
  return valid;
}

constexpr char kCapabilitiesJson[] = R"JSON({
  "api_version":"1.4","base_path":"/api/v1","transport":"http",
  "actions":[
    {"id":"status.read","method":"GET","path":"/status","input":null,"output":{"pid":"string","device_id":"string","state":"string","sd_ready":"boolean","time_valid":"boolean","station_ip":"string","mdns_hostname":"string","local_time":"YYYY-MM-DDTHH:MM:SS|null","unix_time":"integer|null","timezone":"string","weekday":"string|null","clock_source":"ds3231_rtc","automation_enabled":"boolean","active_profile_id":"string","resolved_profile_id":"string","holiday_today":"boolean","cloud":"object","audio":"AudioStatus"}},
    {"id":"config.read","method":"GET","path":"/config","input":null,"output":{"pid":"string","device_id":"string","school_name":"string","timezone":"string","timezone_posix":"string","volume_percent":"integer","wifi":"object"}},
    {"id":"config.update","method":"PUT","path":"/config","input":{"school_name":"string?","timezone":"string?","timezone_posix":"POSIX TZ string?","volume_percent":"integer[0,100]?","wifi":"object?","announcement":{"physical_ptt_enabled":"boolean?","mic_gain_percent":"integer[25,800]?"}},"output":{"ok":"boolean","persisted_to_internal_flash":"boolean"}},
    {"id":"announcement.status","method":"GET","path":"/announcement/status","input":null,"output":"AudioStatus"},
    {"id":"cloud.read","method":"GET","path":"/cloud","input":null,"output":{"configured":"boolean","connected":"boolean","enabled":"boolean","homeId":"string","mqttHost":"string","mqttPort":"integer","mqttUsernameConfigured":"boolean"}},
    {"id":"cloud.update","method":"PUT","path":"/cloud","input":{"enabled":"boolean?","homeId":"string?","mqttHost":"string?","mqttPort":"integer[1,65535]?"},"output":{"ok":"boolean","configured":"boolean"}},
    {"id":"cloud.credential.update","method":"PUT","path":"/device-mqtt-credential","input":{"mqttUsername":"string?","mqttPassword":"string?","activateForCloudBroker":"boolean?"},"output":{"ok":"boolean","mqttUsernameConfigured":"boolean"}},
    {"id":"schedule.list_active","method":"GET","path":"/schedules","input":null,"output":{"active_profile_id":"string","schedules":"Schedule[]"}},
    {"id":"schedule.replace_active","method":"PUT","path":"/schedules","input":"Schedule[]","output":{"ok":"boolean","count":"integer","active_profile_id":"string"}},
    {"id":"profiles.read","method":"GET","path":"/schedule-profiles","input":null,"output":"SchedulePack"},
    {"id":"profiles.replace","method":"PUT","path":"/schedule-profiles","input":"SchedulePack","output":{"ok":"boolean","profile_count":"integer","rule_count":"integer"}},
    {"id":"profiles.activate","method":"PUT","path":"/active-profile","input":{"profile_id":"string"},"output":{"ok":"boolean","active_profile_id":"string"}},
    {"id":"automation.update","method":"PUT","path":"/automation","input":{"enabled":"boolean"},"output":{"ok":"boolean","automation_enabled":"boolean"}},
    {"id":"holidays.read","method":"GET","path":"/holidays","input":null,"output":{"holidays":"Holiday[]"}},
    {"id":"holidays.replace","method":"PUT","path":"/holidays","input":"Holiday[]","output":{"ok":"boolean","count":"integer"}},
    {"id":"presets.read","method":"GET","path":"/presets","input":null,"output":{"presets":"BellPreset[]"}},
    {"id":"presets.replace","method":"PUT","path":"/presets","input":"BellPreset[]","output":{"ok":"boolean","count":"integer"}},
    {"id":"logs.read","method":"GET","path":"/logs?limit={1..500}","input":null,"output":{"logs":"string[]"}},
    {"id":"logs.clear","method":"DELETE","path":"/logs","input":null,"output":{"ok":"boolean"}},
    {"id":"sound.list","method":"GET","path":"/sounds","input":null,"output":{"sounds":"Sound[]"}},
    {"id":"sound.preview","method":"GET","path":"/sounds/content?name={filename}","input":null,"output":"audio/mpeg|audio/wav byte stream"},
    {"id":"sound.upload","method":"POST","path":"/sd/upload?name={filename}","content_type":"application/octet-stream","input":"binary mp3|wav <=64MiB","output":{"ok":"boolean","id":"string","name":"string","bytes":"integer"}},
    {"id":"sound.delete","method":"DELETE","path":"/sounds?name={filename}","input":null,"output":{"ok":"boolean","id":"string"}},
    {"id":"internal.sound.list","method":"GET","path":"/internal/sounds","input":null,"output":{"sounds":"Sound[]"}},
    {"id":"internal.sound.upload","method":"POST","path":"/internal/sounds?name={filename}","content_type":"application/octet-stream","input":"binary mp3|wav","output":{"ok":"boolean","id":"string","bytes":"integer"}},
    {"id":"internal.sound.delete","method":"DELETE","path":"/internal/sounds?name={filename}","input":null,"output":{"ok":"boolean","id":"string"}},
    {"id":"internal.sound.preview","method":"GET","path":"/internal/sounds/content?name={filename}","input":null,"output":"audio/mpeg|audio/wav byte stream"},
    {"id":"festival.read","method":"GET","path":"/festival","input":null,"output":{"sound_id":"festival/current","storage":"internal-flash","file":"Sound|null"}},
    {"id":"festival.upload","method":"POST","path":"/festival/upload?name={filename}","content_type":"application/octet-stream","input":"binary mp3|wav","output":{"ok":"boolean","sound_id":"festival/current","bytes":"integer"}},
    {"id":"festival.preview","method":"GET","path":"/festival/content","input":null,"output":"audio/mpeg|audio/wav byte stream"},
    {"id":"festival.clear","method":"DELETE","path":"/festival","input":null,"output":{"ok":"boolean","cleared":"boolean"}},
    {"id":"announcement.websocket","method":"GET","path":"/announcement/ws","transport":"websocket","input":"control JSON + PCM binary frames","output":"ready|stopped|error control JSON"},
    {"id":"sd.bells.browse","method":"GET","path":"/sd/browse?path=/bells&offset={integer}&limit={1..100}","input":null,"output":{"path":"string","entries":"SdEntry[]","has_more":"boolean"}},
    {"id":"bell.ring","method":"POST","path":"/bell/ring","input":{"name":"string?","soundId":"string","duration":"integer[0,3600]"},"output":{"ok":"boolean"}},
    {"id":"audio.diagnostic","method":"POST","path":"/audio/diagnostic","input":null,"output":{"ok":"boolean","frequency_hz":"integer","duration_ms":"integer"}},
    {"id":"clock.set","method":"POST","path":"/time","input":{"local_time":"YYYY-MM-DDTHH:MM[:SS]"},"output":{"ok":"boolean"}},
    {"id":"sd.format","method":"POST","path":"/sd/format","destructive":true,"input":{"confirm":"FORMAT"},"output":{"ok":"boolean","filesystem":"FAT32"}}
  ],
  "types":{
    "Schedule":{"id":"integer","name":"string","time":"HH:MM","type":"string","sound_id":"string","duration":"integer[0,3600]","days":"integer[0..6][]","enabled":"boolean"},
    "ScheduleProfile":{"id":"string","name":"string","category":"regular|summer|winter|exam|custom","enabled":"boolean","schedules":"Schedule[]"},
    "CalendarRule":{"id":"integer","name":"string","profile_id":"string","start_date":"YYYY-MM-DD?","end_date":"YYYY-MM-DD?","priority":"integer[-1000,1000]","repeat_yearly":"boolean","days":"integer[0..6][]","enabled":"boolean"},
    "SchedulePack":{"active_profile_id":"string","automation_enabled":"boolean","profiles":"ScheduleProfile[]","calendar_rules":"CalendarRule[]"},
    "Holiday":{"date":"YYYY-MM-DD","name":"string","type":"holiday|closed|event"},
    "BellPreset":{"id":"integer|string","label":"string","sound_id":"string","duration":"integer[0,3600]","category":"string"},
    "Sound":{"id":"string","name":"string","format":"mp3|wav","bytes":"integer","duration":"number|null","content_url":"string"},
    "SdEntry":{"name":"string","path":"string","type":"folder|audio","sound_id":"string?","format":"mp3|wav?","bytes":"integer?","duration":"number|null?"},
    "AudioStatus":{"busy":"boolean","busy_reason":"none|bell|physical_announcement|soft_announcement","bell_active":"boolean","announcement_active":"boolean","announcement_source":"none|physical|soft","physical_ptt_supported":"boolean","physical_ptt_enabled":"boolean","physical_ptt_pressed":"boolean","soft_ptt_supported":"boolean","soft_ptt_active":"boolean","physical_ptt_gpio":"integer","mic_adc_gpio":"integer","mic_adc_unit":"integer","mic_adc_channel":"integer","mic_gain_percent":"integer","collision_policy":"pause_announcement_play_bell_resume"}
  }
})JSON";

void setCors(httpd_req_t* req) {
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Headers", "Content-Type");
}

esp_err_t sendJson(httpd_req_t* req, const char* payload, const char* status = nullptr) {
  setCors(req);
  if (status != nullptr) httpd_resp_set_status(req, status);
  httpd_resp_set_type(req, "application/json");
  return httpd_resp_sendstr(req, payload == nullptr ? "{}" : payload);
}

esp_err_t sendJsonObject(httpd_req_t* req, cJSON* root, const char* status = nullptr) {
  if (root == nullptr) return sendJson(req, "{\"error\":\"out of memory\"}", "500 Internal Server Error");
  char* payload = cJSON_PrintUnformatted(root);
  cJSON_Delete(root);
  const esp_err_t result = sendJson(req, payload, status);
  cJSON_free(payload);
  return result;
}

esp_err_t sendError(httpd_req_t* req, const char* status, const char* message) {
  cJSON* root = cJSON_CreateObject();
  cJSON_AddBoolToObject(root, "ok", false);
  cJSON_AddStringToObject(root, "error", message);
  return sendJsonObject(req, root, status);
}

esp_err_t readBody(httpd_req_t* req, size_t limit, std::string* body) {
  if (body == nullptr) return ESP_ERR_INVALID_ARG;
  const size_t length = req->content_len > 0 ? static_cast<size_t>(req->content_len) : 0U;
  if (length > limit) return ESP_ERR_INVALID_SIZE;
  body->assign(length, '\0');
  size_t received = 0;
  while (received < length) {
    const int count = httpd_req_recv(req, body->data() + received, length - received);
    if (count == HTTPD_SOCK_ERR_TIMEOUT) continue;
    if (count <= 0) return ESP_FAIL;
    received += static_cast<size_t>(count);
  }
  return ESP_OK;
}

std::string requestPath(const char* uri) {
  const std::string full = uri == nullptr ? "" : uri;
  const size_t query = full.find('?');
  return query == std::string::npos ? full : full.substr(0, query);
}

bool hasAudioExtension(const std::string& name, std::string* extension = nullptr) {
  const size_t dot = name.find_last_of('.');
  if (dot == std::string::npos) return false;
  std::string ext = name.substr(dot + 1);
  std::transform(ext.begin(), ext.end(), ext.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
  if (extension != nullptr) *extension = ext;
  return ext == "mp3" || ext == "wav";
}

bool safeFileName(const std::string& name) {
  if (name.empty() || name.size() > 240 || name == "." || name == ".." || !hasAudioExtension(name)) return false;
  if (name.find("..") != std::string::npos || name.find('/') != std::string::npos || name.find('\\') != std::string::npos || name.find(':') != std::string::npos) return false;
  for (unsigned char c : name) if (c < 0x20) return false;
  return true;
}

bool safeBellPath(const std::string& path) {
  if (path != "/bells" && path.rfind("/bells/", 0) != 0) return false;
  if (path.size() > 1024 || path.find("..") != std::string::npos ||
      path.find('\\') != std::string::npos || path.find(':') != std::string::npos) return false;
  for (const unsigned char c : path) if (c < 0x20) return false;
  return true;
}

std::string soundIdFromFile(const std::string& name) {
  const size_t dot = name.find_last_of('.');
  return dot == std::string::npos ? name : name.substr(0, dot);
}

int hexValue(char value) {
  if (value >= '0' && value <= '9') return value - '0';
  if (value >= 'a' && value <= 'f') return value - 'a' + 10;
  if (value >= 'A' && value <= 'F') return value - 'A' + 10;
  return -1;
}

std::string urlDecode(const std::string& value) {
  std::string decoded;
  decoded.reserve(value.size());
  for (size_t index = 0; index < value.size(); ++index) {
    if (value[index] == '%' && index + 2 < value.size()) {
      const int high = hexValue(value[index + 1]);
      const int low = hexValue(value[index + 2]);
      if (high >= 0 && low >= 0) {
        decoded.push_back(static_cast<char>((high << 4) | low));
        index += 2;
        continue;
      }
    }
    decoded.push_back(value[index] == '+' ? ' ' : value[index]);
  }
  return decoded;
}

std::string urlEncode(const std::string& value) {
  constexpr char kHex[] = "0123456789ABCDEF";
  std::string encoded;
  encoded.reserve(value.size() * 3);
  for (unsigned char byte : value) {
    if (std::isalnum(byte) || byte == '-' || byte == '_' || byte == '.' || byte == '~') {
      encoded.push_back(static_cast<char>(byte));
    } else {
      encoded.push_back('%');
      encoded.push_back(kHex[(byte >> 4) & 0x0f]);
      encoded.push_back(kHex[byte & 0x0f]);
    }
  }
  return encoded;
}

bool queryValue(httpd_req_t* req, const char* key, std::string* value) {
  if (req == nullptr || key == nullptr || value == nullptr) return false;
  char query[2048] = {};
  char buffer[2048] = {};
  if (httpd_req_get_url_query_str(req, query, sizeof(query)) != ESP_OK ||
      httpd_query_key_value(query, key, buffer, sizeof(buffer)) != ESP_OK) return false;
  *value = urlDecode(buffer);
  return true;
}

void addDaysJson(cJSON* parent, const std::array<bool, 7>& enabled) {
  cJSON* days = cJSON_AddArrayToObject(parent, "days");
  for (size_t day = 0; day < enabled.size(); ++day) if (enabled[day]) cJSON_AddItemToArray(days, cJSON_CreateNumber(day));
}

void addScheduleJson(cJSON* list, const ScheduleEntry& entry) {
  cJSON* item = cJSON_CreateObject();
  cJSON_AddNumberToObject(item, "id", static_cast<double>(entry.id));
  cJSON_AddStringToObject(item, "name", entry.name.c_str());
  cJSON_AddStringToObject(item, "time", entry.time_hhmm.c_str());
  cJSON_AddStringToObject(item, "type", entry.type.c_str());
  cJSON_AddStringToObject(item, "sound_id", entry.sound_id.c_str());
  cJSON_AddNumberToObject(item, "duration", entry.duration_seconds);
  addDaysJson(item, entry.days_enabled);
  cJSON_AddBoolToObject(item, "enabled", entry.enabled);
  cJSON_AddItemToArray(list, item);
}

cJSON* makeAudioStatusJson(const AudioService& audio) {
  cJSON* status = cJSON_CreateObject();
  if (status == nullptr) return nullptr;
  cJSON_AddBoolToObject(status, "busy", audio.audioBusy());
  cJSON_AddStringToObject(status, "busy_reason", audio.busyReason());
  cJSON_AddBoolToObject(status, "bell_active", audio.bellActive());
  cJSON_AddBoolToObject(status, "announcement_active", audio.announcementActive());
  cJSON_AddBoolToObject(status, "soft_ptt_supported", true);
  cJSON_AddBoolToObject(status, "soft_ptt_active", audio.softAnnouncementActive());
  cJSON_AddStringToObject(status, "announcement_source",
                          audio.softAnnouncementActive() ? "soft" :
                          (audio.announcementActive() ? "physical" : "none"));
  cJSON_AddBoolToObject(status, "physical_ptt_supported", audio.announcementSupported());
  cJSON_AddBoolToObject(status, "physical_ptt_enabled", audio.physicalPttEnabled());
  cJSON_AddBoolToObject(status, "physical_ptt_pressed", audio.pttPressed());
  cJSON_AddNumberToObject(status, "physical_ptt_gpio", board::kAnnouncementPtt);
  cJSON_AddNumberToObject(status, "mic_adc_gpio", board::kAnnouncementMicAdc);
  cJSON_AddNumberToObject(status, "mic_adc_unit", 1);
  cJSON_AddNumberToObject(status, "mic_adc_channel", board::kAnnouncementMicAdcChannel);
  cJSON_AddNumberToObject(status, "mic_gain_percent", audio.physicalPttGainPercent());
  cJSON_AddStringToObject(status, "mode", "hold_to_talk_active_low");
  cJSON_AddStringToObject(status, "collision_policy", "pause_announcement_play_bell_resume");
  return status;
}
}  // namespace

esp_err_t WebService::start(SnapshotProvider snapshot_provider, RingHandler ring_handler) {
  snapshot_provider_ = std::move(snapshot_provider);
  ring_handler_ = std::move(ring_handler);

  httpd_config_t server_config = HTTPD_DEFAULT_CONFIG();
  server_config.server_port = app::config::kHttpPort;
  server_config.stack_size = app::config::kWebServerStackSize;
  server_config.max_uri_handlers = 9;
  server_config.lru_purge_enable = true;
  server_config.recv_wait_timeout = 30;
  server_config.send_wait_timeout = 30;
  server_config.uri_match_fn = httpd_uri_match_wildcard;
  ESP_RETURN_ON_ERROR(httpd_start(&server_, &server_config), kTag, "httpd start failed");

  auto register_route = [this](const char* uri, httpd_method_t method, esp_err_t (*handler)(httpd_req_t*)) {
    httpd_uri_t route = {};
    route.uri = uri;
    route.method = method;
    route.handler = handler;
    route.user_ctx = this;
    return httpd_register_uri_handler(server_, &route);
  };
  ESP_RETURN_ON_ERROR(register_route("/", HTTP_GET, &WebService::handleUi), kTag, "UI route failed");
  httpd_uri_t announcement_ws = {};
  announcement_ws.uri = "/api/v1/announcement/ws";
  announcement_ws.method = HTTP_GET;
  announcement_ws.handler = &WebService::handleAnnouncementWebSocket;
  announcement_ws.user_ctx = this;
  announcement_ws.is_websocket = true;
  ESP_RETURN_ON_ERROR(httpd_register_uri_handler(server_, &announcement_ws), kTag, "announcement WebSocket route failed");
  ESP_RETURN_ON_ERROR(register_route("/api/v1/*", HTTP_GET, &WebService::handleApi), kTag, "API GET route failed");
  ESP_RETURN_ON_ERROR(register_route("/api/v1/*", HTTP_POST, &WebService::handleApi), kTag, "API POST route failed");
  ESP_RETURN_ON_ERROR(register_route("/api/v1/*", HTTP_PUT, &WebService::handleApi), kTag, "API PUT route failed");
  ESP_RETURN_ON_ERROR(register_route("/api/v1/*", HTTP_DELETE, &WebService::handleApi), kTag, "API DELETE route failed");
  ESP_RETURN_ON_ERROR(register_route("/api/v1/*", HTTP_OPTIONS, &WebService::handleApi), kTag, "API OPTIONS route failed");
  ESP_RETURN_ON_ERROR(register_route("/api/status", HTTP_GET, &WebService::handleLegacyStatus), kTag, "legacy status route failed");
  ESP_RETURN_ON_ERROR(register_route("/api/bell/ring", HTTP_POST, &WebService::handleLegacyRing), kTag, "legacy ring route failed");
  return ESP_OK;
}

void WebService::stop() {
  if (server_ != nullptr) {
    httpd_stop(server_);
    server_ = nullptr;
  }
}

esp_err_t WebService::handleUi(httpd_req_t* req) {
  httpd_resp_set_type(req, "text/html; charset=utf-8");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");
  return httpd_resp_send(req, web_ui::kIndexHtml, HTTPD_RESP_USE_STRLEN);
}

esp_err_t WebService::handleApi(httpd_req_t* req) {
  auto* self = static_cast<WebService*>(req->user_ctx);
  return self == nullptr ? ESP_FAIL : self->dispatchApi(req);
}

esp_err_t WebService::handleLegacyStatus(httpd_req_t* req) {
  auto* self = static_cast<WebService*>(req->user_ctx);
  return self == nullptr ? ESP_FAIL : self->renderStatus(req);
}

esp_err_t WebService::handleLegacyRing(httpd_req_t* req) {
  auto* self = static_cast<WebService*>(req->user_ctx);
  return self == nullptr ? ESP_FAIL : self->processRing(req);
}

esp_err_t WebService::handleAnnouncementWebSocket(httpd_req_t* req) {
  auto* self = static_cast<WebService*>(req->user_ctx);
  if (self == nullptr) return ESP_FAIL;
  if (req->method == HTTP_GET) return ESP_OK;
  const int socket = httpd_req_to_sockfd(req);

  auto release_session = [self, socket]() {
    int owner = socket;
    if (self->soft_ptt_socket_.compare_exchange_strong(owner, -1)) {
      self->audio_.stopSoftAnnouncement();
    }
  };

  httpd_ws_frame_t frame = {};
  esp_err_t result = httpd_ws_recv_frame(req, &frame, 0);
  if (result != ESP_OK) {
    release_session();
    return result;
  }
  if (frame.len > app::config::kSoftAnnouncementMaxFrameBytes) {
    release_session();
    return ESP_ERR_INVALID_SIZE;
  }
  std::vector<uint8_t> payload(frame.len + 1U, 0);
  frame.payload = payload.data();
  if (frame.len > 0) {
    result = httpd_ws_recv_frame(req, &frame, frame.len);
    if (result != ESP_OK) {
      release_session();
      return result;
    }
  }

  auto send_text = [req](const char* message) {
    httpd_ws_frame_t response = {};
    response.type = HTTPD_WS_TYPE_TEXT;
    response.payload = reinterpret_cast<uint8_t*>(const_cast<char*>(message));
    response.len = std::strlen(message);
    return httpd_ws_send_frame(req, &response);
  };

  if (frame.type == HTTPD_WS_TYPE_CLOSE) {
    release_session();
    return ESP_OK;
  }
  if (frame.type == HTTPD_WS_TYPE_BINARY) {
    if (self->soft_ptt_socket_.load() != socket || !self->audio_.softAnnouncementActive()) {
      return send_text("{\"type\":\"error\",\"error\":\"send start before PCM frames\"}");
    }
    result = self->audio_.pushSoftAnnouncementPcm(payload.data(), frame.len);
    return result == ESP_OK ? ESP_OK :
           send_text("{\"type\":\"error\",\"error\":\"PCM frame rejected\"}");
  }
  if (frame.type != HTTPD_WS_TYPE_TEXT) return ESP_OK;

  cJSON* root = cJSON_Parse(reinterpret_cast<const char*>(payload.data()));
  const cJSON* type = cJSON_IsObject(root) ? cJSON_GetObjectItemCaseSensitive(root, "type") : nullptr;
  if (!cJSON_IsString(type)) {
    cJSON_Delete(root);
    return send_text("{\"type\":\"error\",\"error\":\"JSON type is required\"}");
  }
  if (std::strcmp(type->valuestring, "stop") == 0) {
    cJSON_Delete(root);
    if (self->soft_ptt_socket_.load() != socket) {
      return send_text("{\"type\":\"error\",\"error\":\"this socket does not own the announcement\"}");
    }
    release_session();
    return send_text("{\"type\":\"stopped\"}");
  }
  if (std::strcmp(type->valuestring, "start") != 0) {
    cJSON_Delete(root);
    return send_text("{\"type\":\"error\",\"error\":\"unsupported control message\"}");
  }
  const cJSON* format = cJSON_GetObjectItemCaseSensitive(root, "format");
  const cJSON* sample_rate = cJSON_GetObjectItemCaseSensitive(root, "sample_rate");
  const cJSON* channels = cJSON_GetObjectItemCaseSensitive(root, "channels");
  const bool valid = cJSON_IsString(format) && std::strcmp(format->valuestring, "pcm_s16le") == 0 &&
                     cJSON_IsNumber(sample_rate) && sample_rate->valueint == static_cast<int>(app::config::kAnnouncementSampleRate) &&
                     cJSON_IsNumber(channels) && channels->valueint == 1;
  cJSON_Delete(root);
  if (!valid) {
    return send_text("{\"type\":\"error\",\"error\":\"required format is pcm_s16le/22050Hz/mono\"}");
  }
  int owner = self->soft_ptt_socket_.load();
  if (owner != -1 && owner != socket && !self->audio_.softAnnouncementActive()) {
    self->soft_ptt_socket_.compare_exchange_strong(owner, -1);
  }
  owner = -1;
  if (!self->soft_ptt_socket_.compare_exchange_strong(owner, socket) && owner != socket) {
    return send_text("{\"type\":\"error\",\"error\":\"another soft announcement client is active\"}");
  }
  if (self->audio_.startSoftAnnouncement() != ESP_OK) {
    int claimed = socket;
    self->soft_ptt_socket_.compare_exchange_strong(claimed, -1);
    return send_text("{\"type\":\"error\",\"error\":\"another announcement source is active\"}");
  }
  return send_text("{\"type\":\"ready\",\"format\":\"pcm_s16le\",\"sample_rate\":22050,\"channels\":1}");
}

esp_err_t WebService::dispatchApi(httpd_req_t* req) {
  if (req->method == HTTP_OPTIONS) return sendJson(req, "{}", "204 No Content");
  const std::string path = requestPath(req->uri);
  if (path == "/api/v1/capabilities" && req->method == HTTP_GET) return renderCapabilities(req);
  if (path == "/api/v1/status" && req->method == HTTP_GET) return renderStatus(req);
  if (path == "/api/v1/config" && req->method == HTTP_GET) return renderConfig(req);
  if (path == "/api/v1/config" && req->method == HTTP_PUT) return updateConfig(req);
  if (path == "/api/v1/announcement/status" && req->method == HTTP_GET) return renderAnnouncementStatus(req);
  if (path == "/api/v1/cloud" && req->method == HTTP_GET) return renderCloud(req);
  if (path == "/api/v1/cloud" && req->method == HTTP_PUT) return updateCloud(req);
  if (path == "/api/v1/device-mqtt-credential" && req->method == HTTP_PUT) return updateDeviceMqttCredential(req);
  if (path == "/api/v1/schedules" && req->method == HTTP_GET) return renderSchedules(req);
  if (path == "/api/v1/schedules" && req->method == HTTP_PUT) return updateSchedules(req);
  if (path == "/api/v1/schedule-profiles" && req->method == HTTP_GET) return renderScheduleProfiles(req);
  if (path == "/api/v1/schedule-profiles" && req->method == HTTP_PUT) return updateScheduleProfiles(req);
  if (path == "/api/v1/active-profile" && req->method == HTTP_PUT) return setActiveProfile(req);
  if (path == "/api/v1/automation" && req->method == HTTP_PUT) return setAutomation(req);
  if (path == "/api/v1/holidays" && req->method == HTTP_GET) return renderHolidays(req);
  if (path == "/api/v1/holidays" && req->method == HTTP_PUT) return updateHolidays(req);
  if (path == "/api/v1/presets" && req->method == HTTP_GET) return renderPresets(req);
  if (path == "/api/v1/presets" && req->method == HTTP_PUT) return updatePresets(req);
  if (path == "/api/v1/logs" && req->method == HTTP_GET) return renderLogs(req);
  if (path == "/api/v1/logs" && req->method == HTTP_DELETE) return clearLogs(req);
  if (path == "/api/v1/sounds/content" && req->method == HTTP_GET) return streamSound(req);
  if (path == "/api/v1/sounds" && req->method == HTTP_GET) return renderSounds(req);
  if (path == "/api/v1/sounds" && req->method == HTTP_DELETE) return deleteSound(req);
  if (path == "/api/v1/internal/sounds/content" && req->method == HTTP_GET) return streamSound(req);
  if (path == "/api/v1/internal/sounds" && req->method == HTTP_GET) return renderSounds(req);
  if (path == "/api/v1/internal/sounds" && req->method == HTTP_DELETE) return deleteSound(req);
  if (path == "/api/v1/internal/sounds" && req->method == HTTP_POST) return uploadSound(req);
  if (path == "/api/v1/festival" && req->method == HTTP_GET) return renderFestival(req);
  if (path == "/api/v1/festival" && req->method == HTTP_DELETE) return clearFestival(req);
  if (path == "/api/v1/festival/upload" && req->method == HTTP_POST) return uploadFestival(req);
  if (path == "/api/v1/festival/content" && req->method == HTTP_GET) return streamFestival(req);
  if (path == "/api/v1/sd/browse" && req->method == HTTP_GET) return browseBellFolder(req);
  if (path == "/api/v1/bell/ring" && req->method == HTTP_POST) return processRing(req);
  if (path == "/api/v1/audio/diagnostic" && req->method == HTTP_POST) return playDiagnosticTone(req);
  if (path == "/api/v1/time" && req->method == HTTP_POST) return updateTime(req);
  if (path == "/api/v1/sd/format" && req->method == HTTP_POST) return formatSd(req);
  if (path == "/api/v1/sd/upload" && req->method == HTTP_POST) return uploadSound(req);
  return sendError(req, "404 Not Found", "unknown API action");
}

esp_err_t WebService::renderCapabilities(httpd_req_t* req) {
  cJSON* root = cJSON_Parse(kCapabilitiesJson);
  if (root == nullptr) return sendError(req, "500 Internal Server Error", "capabilities unavailable");
  cJSON_AddStringToObject(root, "firmware_version", app::config::kFirmwareVersion);
  return sendJsonObject(req, root);
}

esp_err_t WebService::renderStatus(httpd_req_t* req) {
  const RuntimeSnapshot snapshot = snapshot_provider_ ? snapshot_provider_() : RuntimeSnapshot{};
  const DeviceConfig& active_config = config_.deviceConfig();
  cJSON* root = cJSON_CreateObject();
  cJSON_AddBoolToObject(root, "ok", true);
  cJSON_AddStringToObject(root, "firmware_version", app::config::kFirmwareVersion);
  cJSON_AddStringToObject(root, "api_version", app::config::kApiVersion);
  cJSON_AddStringToObject(root, "pid", app::config::kProductId);
  cJSON_AddStringToObject(root, "state", toString(snapshot.state));
  cJSON_AddBoolToObject(root, "time_valid", snapshot.time_valid);
  cJSON_AddBoolToObject(root, "internal_storage_ready", storage_.isReady());
  cJSON_AddBoolToObject(root, "sd_ready", storage_.sdReady());
  size_t internal_total = 0;
  size_t internal_used = 0;
  if (storage_.internalInfo(&internal_total, &internal_used) == ESP_OK) {
    cJSON* internal = cJSON_AddObjectToObject(root, "internal_storage");
    cJSON_AddNumberToObject(internal, "total_bytes", static_cast<double>(internal_total));
    cJSON_AddNumberToObject(internal, "used_bytes", static_cast<double>(internal_used));
    cJSON_AddNumberToObject(internal, "free_bytes", static_cast<double>(internal_total - internal_used));
  }
  cJSON_AddBoolToObject(root, "wifi_ready", wifi_.isReady());
  cJSON_AddBoolToObject(root, "station_connected", wifi_.isConnected());
  cJSON_AddStringToObject(root, "station_ssid", wifi_.activeSsid().c_str());
  cJSON_AddStringToObject(root, "station_ip", wifi_.stationIp().c_str());
  cJSON_AddStringToObject(root, "ap_ssid", wifi_.apSsid());
  cJSON_AddStringToObject(root, "ap_url", "http://192.168.4.1/");
  cJSON_AddStringToObject(root, "mdns_hostname", wifi_.mdnsHostname().c_str());
  cJSON_AddStringToObject(root, "mdns_url", ("http://" + wifi_.mdnsHostname() + ".local/").c_str());
  cJSON_AddBoolToObject(root, "sync_in_progress", snapshot.sync_in_progress);
  cJSON_AddNumberToObject(root, "content_version", snapshot.content_version);
  cJSON_AddStringToObject(root, "device_id", active_config.device_id.c_str());
  cJSON_AddStringToObject(root, "school_name", active_config.school_name.c_str());
  cJSON_AddStringToObject(root, "timezone", active_config.timezone.c_str());
  cJSON_AddStringToObject(root, "timezone_posix", active_config.timezone_posix.c_str());
  cJSON_AddStringToObject(root, "clock_source", "ds3231_rtc");
  cJSON_AddStringToObject(root, "last_fault", snapshot.last_fault.c_str());
  cJSON_AddStringToObject(root, "active_profile_id", schedules_.activeProfileId().c_str());
  cJSON_AddBoolToObject(root, "automation_enabled", schedules_.automationEnabled());
  cJSON_AddItemToObject(root, "audio", makeAudioStatusJson(audio_));
  const CloudConfig cloud_config = cloud_.config();
  cJSON* cloud = cJSON_AddObjectToObject(root, "cloud");
  cJSON_AddBoolToObject(cloud, "configured", cloud_.configured());
  cJSON_AddBoolToObject(cloud, "connected", cloud_.connected());
  cJSON_AddBoolToObject(cloud, "enabled", cloud_config.enabled);
  cJSON_AddStringToObject(cloud, "homeId", cloud_config.home_id.c_str());
  cJSON* ota = cJSON_AddObjectToObject(cloud, "ota");
  cJSON_AddBoolToObject(ota, "active", cloud_.ota().active());
  cJSON_AddStringToObject(ota, "status", cloud_.ota().status().c_str());
  cJSON_AddStringToObject(ota, "message", cloud_.ota().message().c_str());
  std::tm now{};
  if (time_.getLocalTime(&now) == ESP_OK) {
    char text[32] = {};
    char date[16] = {};
    char weekday[16] = {};
    std::strftime(text, sizeof(text), "%Y-%m-%dT%H:%M:%S", &now);
    std::strftime(date, sizeof(date), "%Y-%m-%d", &now);
    std::strftime(weekday, sizeof(weekday), "%A", &now);
    cJSON_AddStringToObject(root, "local_time", text);
    cJSON_AddNumberToObject(root, "unix_time", static_cast<double>(std::time(nullptr)));
    cJSON_AddStringToObject(root, "local_date", date);
    cJSON_AddStringToObject(root, "weekday", weekday);
    cJSON_AddStringToObject(root, "resolved_profile_id", schedules_.resolvedProfileId(now).c_str());
    cJSON_AddBoolToObject(root, "holiday_today", holidays_.isHoliday(now));
  } else {
    cJSON_AddNullToObject(root, "local_time");
    cJSON_AddNullToObject(root, "unix_time");
    cJSON_AddNullToObject(root, "local_date");
    cJSON_AddNullToObject(root, "weekday");
    cJSON_AddStringToObject(root, "resolved_profile_id", schedules_.activeProfileId().c_str());
    cJSON_AddBoolToObject(root, "holiday_today", false);
  }
  return sendJsonObject(req, root);
}

esp_err_t WebService::renderConfig(httpd_req_t* req) {
  const DeviceConfig& value = config_.deviceConfig();
  cJSON* root = cJSON_CreateObject();
  cJSON_AddStringToObject(root, "pid", app::config::kProductId);
  cJSON_AddStringToObject(root, "device_id", value.device_id.c_str());
  cJSON_AddStringToObject(root, "school_name", value.school_name.c_str());
  cJSON_AddStringToObject(root, "timezone", value.timezone.c_str());
  cJSON_AddStringToObject(root, "timezone_posix", value.timezone_posix.c_str());
  cJSON_AddNumberToObject(root, "volume_percent", value.volume_percent);
  cJSON* announcement = cJSON_AddObjectToObject(root, "announcement");
  cJSON_AddBoolToObject(announcement, "physical_ptt_enabled", value.physical_ptt_enabled);
  cJSON_AddNumberToObject(announcement, "mic_gain_percent", value.physical_ptt_gain_percent);
  cJSON* wifi = cJSON_AddObjectToObject(root, "wifi");
  cJSON_AddStringToObject(wifi, "mode", "client");
  cJSON_AddStringToObject(wifi, "ssid", wifi_.activeSsid().c_str());
  cJSON_AddBoolToObject(wifi, "password_set", wifi_.hasStationConfig());
  return sendJsonObject(req, root);
}

esp_err_t WebService::updateConfig(httpd_req_t* req) {
  std::string body;
  const esp_err_t read_result = readBody(req, app::config::kMaxConfigRequestBytes, &body);
  if (read_result == ESP_ERR_INVALID_SIZE) return sendError(req, "413 Payload Too Large", "configuration payload too large");
  if (read_result != ESP_OK) return sendError(req, "400 Bad Request", "body read failed");
  cJSON* root = cJSON_Parse(body.c_str());
  if (!cJSON_IsObject(root)) {
    cJSON_Delete(root);
    return sendError(req, "400 Bad Request", "invalid configuration JSON");
  }
  DeviceConfig updated = config_.deviceConfig();
  bool wifi_requested = false;
  bool password_provided = false;
  bool timezone_changed = false;
  if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "school_name"); cJSON_IsString(item)) updated.school_name = item->valuestring;
  if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "timezone"); cJSON_IsString(item)) {
    timezone_changed = updated.timezone != item->valuestring;
    updated.timezone = item->valuestring;
  }
  if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "timezone_posix"); cJSON_IsString(item)) {
    timezone_changed = timezone_changed || updated.timezone_posix != item->valuestring;
    updated.timezone_posix = item->valuestring;
  }
  if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "volume_percent"); cJSON_IsNumber(item)) updated.volume_percent = static_cast<uint8_t>(std::clamp(item->valuedouble, 0.0, 100.0));
  if (const cJSON* announcement = cJSON_GetObjectItemCaseSensitive(root, "announcement"); cJSON_IsObject(announcement)) {
    if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(announcement, "physical_ptt_enabled"); cJSON_IsBool(item)) {
      updated.physical_ptt_enabled = cJSON_IsTrue(item);
    }
    if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(announcement, "mic_gain_percent"); cJSON_IsNumber(item)) {
      if (item->valuedouble < 25 || item->valuedouble > app::config::kAnnouncementMaxGainPercent) {
        cJSON_Delete(root);
        return sendError(req, "400 Bad Request", "announcement mic_gain_percent must be 25..800");
      }
      updated.physical_ptt_gain_percent = static_cast<uint16_t>(item->valuedouble);
    }
  }
  if (const cJSON* wifi = cJSON_GetObjectItemCaseSensitive(root, "wifi"); cJSON_IsObject(wifi)) {
    wifi_requested = true;
    if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(wifi, "ssid"); cJSON_IsString(item)) updated.wifi.ssid = item->valuestring;
    if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(wifi, "password"); cJSON_IsString(item)) {
      updated.wifi.password = item->valuestring;
      password_provided = true;
    }
    updated.wifi.mode = "client";
  }
  cJSON_Delete(root);
  if (updated.school_name.size() > 96 || updated.timezone.empty() || updated.timezone.size() > 64 ||
      updated.timezone_posix.empty() || updated.timezone_posix.size() > 127 || updated.wifi.ssid.size() > 32 ||
      updated.wifi.password.size() > 63 || (!updated.wifi.password.empty() && updated.wifi.password.size() < 8)) {
    return sendError(req, "400 Bad Request", "invalid school name, timezone, or Wi-Fi credential length");
  }
  if (timezone_changed && time_.applyTimezone(updated) != ESP_OK) {
    return sendError(req, "400 Bad Request", "timezone_posix could not be applied");
  }
  const bool ssid_changed = updated.wifi.ssid != wifi_.activeSsid();
  if (wifi_requested && ssid_changed && !updated.wifi.ssid.empty() && !password_provided) return sendError(req, "400 Bad Request", "password is required for a new Wi-Fi SSID");
  if (wifi_requested && (ssid_changed || password_provided || updated.wifi.ssid.empty()) &&
      wifi_.applyStationConfig(updated.wifi.ssid, updated.wifi.password) != ESP_OK) {
    return sendError(req, "500 Internal Server Error", "Wi-Fi configuration failed");
  }
  audio_.setVolume(updated.volume_percent);
  audio_.setPhysicalPttConfig(updated.physical_ptt_enabled, updated.physical_ptt_gain_percent);
  const bool persisted = config_.saveDeviceConfig(updated) == ESP_OK;
  cJSON* response = cJSON_CreateObject();
  cJSON_AddBoolToObject(response, "ok", true);
  cJSON_AddBoolToObject(response, "persisted_to_internal_flash", persisted);
  cJSON_AddBoolToObject(response, "station_connecting", !updated.wifi.ssid.empty());
  cJSON_AddBoolToObject(response, "timezone_applied", timezone_changed);
  if (!persisted) cJSON_AddStringToObject(response, "warning", "Wi-Fi saved in NVS; internal flash persistence failed");
  return sendJsonObject(req, response);
}

esp_err_t WebService::renderAnnouncementStatus(httpd_req_t* req) {
  return sendJsonObject(req, makeAudioStatusJson(audio_));
}

esp_err_t WebService::renderCloud(httpd_req_t* req) {
  const CloudConfig value = cloud_.config();
  cJSON* root = cJSON_CreateObject();
  cJSON_AddBoolToObject(root, "configured", cloud_.configured());
  cJSON_AddBoolToObject(root, "connected", cloud_.connected());
  cJSON_AddBoolToObject(root, "enabled", value.enabled);
  cJSON_AddStringToObject(root, "homeId", value.home_id.c_str());
  cJSON_AddStringToObject(root, "mqttHost", value.mqtt_host.c_str());
  cJSON_AddNumberToObject(root, "mqttPort", value.mqtt_port);
  cJSON_AddBoolToObject(root, "mqttUsernameConfigured", !value.mqtt_username.empty());
  cJSON_AddStringToObject(root, "statusTopic", cloud_.statusTopic().c_str());
  cJSON_AddStringToObject(root, "otaTopic", cloud_.otaTopic().c_str());
  return sendJsonObject(req, root);
}

esp_err_t WebService::updateCloud(httpd_req_t* req) {
  std::string body;
  if (readBody(req, app::config::kMaxConfigRequestBytes, &body) != ESP_OK) {
    return sendError(req, "400 Bad Request", "body read failed");
  }
  cJSON* root = cJSON_Parse(body.c_str());
  if (!cJSON_IsObject(root)) {
    cJSON_Delete(root);
    return sendError(req, "400 Bad Request", "invalid cloud configuration JSON");
  }
  CloudConfig updated = cloud_.config();
  if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "enabled"); cJSON_IsBool(item)) updated.enabled = cJSON_IsTrue(item);
  if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "homeId"); cJSON_IsString(item)) updated.home_id = item->valuestring;
  if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "mqttHost"); cJSON_IsString(item)) updated.mqtt_host = item->valuestring;
  if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "mqttPort"); cJSON_IsNumber(item) && item->valuedouble >= 1 && item->valuedouble <= 65535) {
    updated.mqtt_port = static_cast<uint16_t>(item->valuedouble);
  }
  cJSON_Delete(root);
  if (cloud_.saveCloudConfig(updated) != ESP_OK) return sendError(req, "400 Bad Request", "invalid or unpersistable cloud configuration");
  cJSON* response = cJSON_CreateObject();
  cJSON_AddBoolToObject(response, "ok", true);
  cJSON_AddBoolToObject(response, "configured", cloud_.configured());
  cJSON_AddBoolToObject(response, "reconnecting", updated.enabled);
  return sendJsonObject(req, response);
}

esp_err_t WebService::updateDeviceMqttCredential(httpd_req_t* req) {
  std::string body;
  if (readBody(req, app::config::kMaxConfigRequestBytes, &body) != ESP_OK) {
    return sendError(req, "400 Bad Request", "body read failed");
  }
  cJSON* root = cJSON_Parse(body.c_str());
  if (!cJSON_IsObject(root)) {
    cJSON_Delete(root);
    return sendError(req, "400 Bad Request", "invalid MQTT credential JSON");
  }
  const CloudConfig current = cloud_.config();
  std::string username = current.mqtt_username;
  std::string password = current.mqtt_password;
  bool activate = false;
  if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "mqttUsername"); cJSON_IsString(item)) username = item->valuestring;
  if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "mqttPassword"); cJSON_IsString(item)) password = item->valuestring;
  if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "activateForCloudBroker"); cJSON_IsBool(item)) activate = cJSON_IsTrue(item);
  cJSON_Delete(root);
  if (cloud_.saveDeviceCredential(username, password, activate) != ESP_OK) {
    return sendError(req, "400 Bad Request", "invalid or unpersistable MQTT credential");
  }
  cJSON* response = cJSON_CreateObject();
  cJSON_AddBoolToObject(response, "ok", true);
  cJSON_AddBoolToObject(response, "mqttUsernameConfigured", !username.empty());
  cJSON_AddBoolToObject(response, "configured", cloud_.configured());
  return sendJsonObject(req, response);
}

esp_err_t WebService::renderSchedules(httpd_req_t* req) {
  cJSON* root = cJSON_CreateObject();
  cJSON_AddStringToObject(root, "active_profile_id", schedules_.activeProfileId().c_str());
  cJSON* list = cJSON_AddArrayToObject(root, "schedules");
  for (const ScheduleEntry& entry : schedules_.schedules()) addScheduleJson(list, entry);
  return sendJsonObject(req, root);
}

esp_err_t WebService::updateSchedules(httpd_req_t* req) {
  if (!storage_.isReady()) return sendError(req, "409 Conflict", "internal flash is not ready");
  std::string body;
  const esp_err_t read_result = readBody(req, app::config::kMaxScheduleRequestBytes, &body);
  if (read_result == ESP_ERR_INVALID_SIZE) return sendError(req, "413 Payload Too Large", "schedule payload too large");
  if (read_result != ESP_OK) return sendError(req, "400 Bad Request", "body read failed");
  if (schedules_.replaceFromJson(body) != ESP_OK) return sendError(req, "400 Bad Request", "invalid schedule data");
  cJSON* response = cJSON_CreateObject();
  cJSON_AddBoolToObject(response, "ok", true);
  cJSON_AddNumberToObject(response, "count", schedules_.schedules().size());
  cJSON_AddStringToObject(response, "active_profile_id", schedules_.activeProfileId().c_str());
  return sendJsonObject(req, response);
}

esp_err_t WebService::renderScheduleProfiles(httpd_req_t* req) {
  cJSON* root = cJSON_CreateObject();
  cJSON_AddStringToObject(root, "active_profile_id", schedules_.activeProfileId().c_str());
  cJSON_AddBoolToObject(root, "automation_enabled", schedules_.automationEnabled());
  cJSON* profiles = cJSON_AddArrayToObject(root, "profiles");
  for (const ScheduleProfile& profile : schedules_.profiles()) {
    cJSON* item = cJSON_CreateObject();
    cJSON_AddStringToObject(item, "id", profile.id.c_str());
    cJSON_AddStringToObject(item, "name", profile.name.c_str());
    cJSON_AddStringToObject(item, "category", profile.category.c_str());
    cJSON_AddBoolToObject(item, "enabled", profile.enabled);
    cJSON* entries = cJSON_AddArrayToObject(item, "schedules");
    for (const ScheduleEntry& entry : profile.schedules) addScheduleJson(entries, entry);
    cJSON_AddItemToArray(profiles, item);
  }
  cJSON* rules = cJSON_AddArrayToObject(root, "calendar_rules");
  for (const CalendarRule& rule : schedules_.calendarRules()) {
    cJSON* item = cJSON_CreateObject();
    cJSON_AddNumberToObject(item, "id", static_cast<double>(rule.id));
    cJSON_AddStringToObject(item, "name", rule.name.c_str());
    cJSON_AddStringToObject(item, "profile_id", rule.profile_id.c_str());
    cJSON_AddStringToObject(item, "start_date", rule.start_date.c_str());
    cJSON_AddStringToObject(item, "end_date", rule.end_date.c_str());
    cJSON_AddNumberToObject(item, "priority", rule.priority);
    cJSON_AddBoolToObject(item, "repeat_yearly", rule.repeat_yearly);
    addDaysJson(item, rule.days_enabled);
    cJSON_AddBoolToObject(item, "enabled", rule.enabled);
    cJSON_AddItemToArray(rules, item);
  }
  return sendJsonObject(req, root);
}

esp_err_t WebService::updateScheduleProfiles(httpd_req_t* req) {
  if (!storage_.isReady()) return sendError(req, "409 Conflict", "internal flash is not ready");
  std::string body;
  const esp_err_t read_result = readBody(req, app::config::kMaxBellDataRequestBytes, &body);
  if (read_result == ESP_ERR_INVALID_SIZE) return sendError(req, "413 Payload Too Large", "schedule profile payload too large");
  if (read_result != ESP_OK) return sendError(req, "400 Bad Request", "body read failed");
  if (schedules_.replaceProfilesFromJson(body) != ESP_OK) return sendError(req, "400 Bad Request", "invalid schedule profile data");
  cJSON* response = cJSON_CreateObject();
  cJSON_AddBoolToObject(response, "ok", true);
  cJSON_AddNumberToObject(response, "profile_count", schedules_.profiles().size());
  cJSON_AddNumberToObject(response, "rule_count", schedules_.calendarRules().size());
  cJSON_AddStringToObject(response, "active_profile_id", schedules_.activeProfileId().c_str());
  return sendJsonObject(req, response);
}

esp_err_t WebService::setActiveProfile(httpd_req_t* req) {
  if (!storage_.isReady()) return sendError(req, "409 Conflict", "internal flash is not ready");
  std::string body;
  if (readBody(req, 256, &body) != ESP_OK) return sendError(req, "400 Bad Request", "body read failed");
  cJSON* root = cJSON_Parse(body.c_str());
  const cJSON* value = cJSON_IsObject(root) ? cJSON_GetObjectItemCaseSensitive(root, "profile_id") : nullptr;
  const std::string profile_id = cJSON_IsString(value) ? value->valuestring : "";
  cJSON_Delete(root);
  if (profile_id.empty()) return sendError(req, "400 Bad Request", "profile_id is required");
  if (schedules_.setActiveProfile(profile_id) != ESP_OK) return sendError(req, "404 Not Found", "enabled profile not found");
  cJSON* response = cJSON_CreateObject();
  cJSON_AddBoolToObject(response, "ok", true);
  cJSON_AddStringToObject(response, "active_profile_id", schedules_.activeProfileId().c_str());
  return sendJsonObject(req, response);
}

esp_err_t WebService::setAutomation(httpd_req_t* req) {
  if (!storage_.isReady()) return sendError(req, "409 Conflict", "internal flash is not ready");
  std::string body;
  if (readBody(req, 128, &body) != ESP_OK) return sendError(req, "400 Bad Request", "body read failed");
  cJSON* root = cJSON_Parse(body.c_str());
  const cJSON* value = cJSON_IsObject(root) ? cJSON_GetObjectItemCaseSensitive(root, "enabled") : nullptr;
  if (!cJSON_IsBool(value)) {
    cJSON_Delete(root);
    return sendError(req, "400 Bad Request", "enabled boolean is required");
  }
  const bool enabled = cJSON_IsTrue(value);
  cJSON_Delete(root);
  if (schedules_.setAutomationEnabled(enabled) != ESP_OK) return sendError(req, "500 Internal Server Error", "automation state save failed");
  cJSON* response = cJSON_CreateObject();
  cJSON_AddBoolToObject(response, "ok", true);
  cJSON_AddBoolToObject(response, "automation_enabled", schedules_.automationEnabled());
  return sendJsonObject(req, response);
}

esp_err_t WebService::renderHolidays(httpd_req_t* req) {
  cJSON* root = cJSON_CreateObject();
  cJSON* list = cJSON_AddArrayToObject(root, "holidays");
  for (const HolidayEntry& holiday : holidays_.holidays()) {
    cJSON* item = cJSON_CreateObject();
    cJSON_AddStringToObject(item, "date", holiday.date.c_str());
    cJSON_AddStringToObject(item, "name", holiday.name.c_str());
    cJSON_AddStringToObject(item, "type", holiday.type.c_str());
    cJSON_AddItemToArray(list, item);
  }
  return sendJsonObject(req, root);
}

esp_err_t WebService::updateHolidays(httpd_req_t* req) {
  if (!storage_.isReady()) return sendError(req, "409 Conflict", "internal flash is not ready");
  std::string body;
  const esp_err_t read_result = readBody(req, app::config::kMaxBellDataRequestBytes, &body);
  if (read_result == ESP_ERR_INVALID_SIZE) return sendError(req, "413 Payload Too Large", "holiday payload too large");
  if (read_result != ESP_OK) return sendError(req, "400 Bad Request", "body read failed");
  if (holidays_.replaceFromJson(body) != ESP_OK) return sendError(req, "400 Bad Request", "invalid holiday data");
  cJSON* response = cJSON_CreateObject();
  cJSON_AddBoolToObject(response, "ok", true);
  cJSON_AddNumberToObject(response, "count", holidays_.holidays().size());
  return sendJsonObject(req, response);
}

esp_err_t WebService::renderPresets(httpd_req_t* req) {
  cJSON* root = cJSON_CreateObject();
  cJSON* list = nullptr;
  std::string raw;
  if (storage_.readText(app::config::kBellPresetsPath, &raw) == ESP_OK) list = cJSON_Parse(raw.c_str());
  if (!cJSON_IsArray(list)) {
    cJSON_Delete(list);
    list = cJSON_CreateArray();
  }
  cJSON_AddItemToObject(root, "presets", list);
  return sendJsonObject(req, root);
}

esp_err_t WebService::updatePresets(httpd_req_t* req) {
  if (!storage_.isReady()) return sendError(req, "409 Conflict", "internal flash is not ready");
  std::string body;
  const esp_err_t read_result = readBody(req, app::config::kMaxBellDataRequestBytes, &body);
  if (read_result == ESP_ERR_INVALID_SIZE) return sendError(req, "413 Payload Too Large", "preset payload too large");
  if (read_result != ESP_OK) return sendError(req, "400 Bad Request", "body read failed");
  cJSON* root = cJSON_Parse(body.c_str());
  if (!cJSON_IsArray(root) || cJSON_GetArraySize(root) > 128) {
    cJSON_Delete(root);
    return sendError(req, "400 Bad Request", "presets must be an array with at most 128 items");
  }
  const cJSON* item = nullptr;
  cJSON_ArrayForEach(item, root) {
    const cJSON* label = cJSON_IsObject(item) ? cJSON_GetObjectItemCaseSensitive(item, "label") : nullptr;
    const cJSON* sound = cJSON_IsObject(item) ? cJSON_GetObjectItemCaseSensitive(item, "sound_id") : nullptr;
    if (!cJSON_IsString(sound) && cJSON_IsObject(item)) sound = cJSON_GetObjectItemCaseSensitive(item, "sound");
    const cJSON* duration = cJSON_IsObject(item) ? cJSON_GetObjectItemCaseSensitive(item, "duration") : nullptr;
    if (!cJSON_IsNumber(duration) && cJSON_IsObject(item)) duration = cJSON_GetObjectItemCaseSensitive(item, "dur");
    if (!cJSON_IsString(label) || std::strlen(label->valuestring) == 0 || std::strlen(label->valuestring) > 96 || !cJSON_IsString(sound) || std::strlen(sound->valuestring) == 0 || std::strlen(sound->valuestring) > 1024 ||
        !cJSON_IsNumber(duration) || duration->valuedouble < 0 || duration->valuedouble > app::config::kMaxBellDurationSeconds) {
      cJSON_Delete(root);
      return sendError(req, "400 Bad Request", "invalid bell preset");
    }
  }
  const int count = cJSON_GetArraySize(root);
  cJSON_Delete(root);
  if (storage_.writeTextAtomic(app::config::kBellPresetsPath, body) != ESP_OK) return sendError(req, "500 Internal Server Error", "preset save failed");
  cJSON* response = cJSON_CreateObject();
  cJSON_AddBoolToObject(response, "ok", true);
  cJSON_AddNumberToObject(response, "count", count);
  return sendJsonObject(req, response);
}

esp_err_t WebService::renderLogs(httpd_req_t* req) {
  size_t limit = 100;
  std::string value;
  if (queryValue(req, "limit", &value)) {
    try { limit = static_cast<size_t>(std::clamp(std::stoi(value), 1, 500)); }
    catch (...) { return sendError(req, "400 Bad Request", "invalid log limit"); }
  }
  cJSON* root = cJSON_CreateObject();
  cJSON* list = cJSON_AddArrayToObject(root, "logs");
  const std::vector<std::string> lines = logs_.recent(limit);
  for (const std::string& line : lines) cJSON_AddItemToArray(list, cJSON_CreateString(line.c_str()));
  cJSON_AddNumberToObject(root, "count", lines.size());
  cJSON_AddStringToObject(root, "order", "newest_first");
  return sendJsonObject(req, root);
}

esp_err_t WebService::clearLogs(httpd_req_t* req) {
  return logs_.clear() == ESP_OK ? sendJson(req, "{\"ok\":true}") : sendError(req, "500 Internal Server Error", "log clear failed");
}

esp_err_t WebService::renderSounds(httpd_req_t* req) {
  const bool internal_only = requestPath(req->uri) == "/api/v1/internal/sounds";
  config_.refreshBellLibrary();
  audio_.setSoundManifest(config_.soundManifest());
  cJSON* root = cJSON_CreateObject();
  cJSON* list = cJSON_AddArrayToObject(root, "sounds");
  if (storage_.isReady()) {
    const std::string directory = storage_.rootPath() + "/sounds";
    DIR* handle = opendir(directory.c_str());
    if (handle != nullptr) {
      while (const dirent* entry = readdir(handle)) {
        const std::string name = entry->d_name;
        std::string extension;
        if (!hasAudioExtension(name, &extension)) continue;
        const std::string path = directory + "/" + name;
        struct stat info = {};
        if (stat(path.c_str(), &info) != 0 || !S_ISREG(info.st_mode)) continue;
        cJSON* item = cJSON_CreateObject();
        cJSON_AddStringToObject(item, "id", soundIdFromFile(name).c_str());
        cJSON_AddStringToObject(item, "name", name.c_str());
        cJSON_AddStringToObject(item, "format", extension.c_str());
        cJSON_AddStringToObject(item, "source", "internal-flash");
        cJSON_AddNumberToObject(item, "bytes", static_cast<double>(info.st_size));
        uint64_t duration_ms = 0;
        if (cachedMediaDuration(path, extension, info, &duration_ms)) {
          cJSON_AddNumberToObject(item, "duration", static_cast<double>(duration_ms) / 1000.0);
        } else {
          cJSON_AddNullToObject(item, "duration");
        }
        cJSON_AddStringToObject(item, "content_url", ("/api/v1/sounds/content?name=" + urlEncode(name)).c_str());
        cJSON_AddItemToArray(list, item);
      }
      closedir(handle);
    }
    if (!internal_only) for (const auto& [sound_id, asset] : config_.soundManifest()) {
      if (sound_id.rfind("bells/", 0) != 0 || asset.file_path.empty()) continue;
      struct stat info = {};
      if (stat(asset.file_path.c_str(), &info) != 0 || !S_ISREG(info.st_mode)) continue;
      std::string extension;
      if (!hasAudioExtension(asset.file_path, &extension)) continue;
      const std::string display_name = sound_id.substr(std::strlen("bells/"));
      cJSON* item = cJSON_CreateObject();
      cJSON_AddStringToObject(item, "id", sound_id.c_str());
      cJSON_AddStringToObject(item, "name", display_name.c_str());
      cJSON_AddStringToObject(item, "path", ("/bells/" + display_name).c_str());
      cJSON_AddStringToObject(item, "format", extension.c_str());
      cJSON_AddStringToObject(item, "source", "sd-card");
      cJSON_AddNumberToObject(item, "bytes", static_cast<double>(info.st_size));
      uint64_t duration_ms = 0;
      if (cachedMediaDuration(asset.file_path, extension, info, &duration_ms)) {
        cJSON_AddNumberToObject(item, "duration", static_cast<double>(duration_ms) / 1000.0);
      } else {
        cJSON_AddNullToObject(item, "duration");
      }
      cJSON_AddStringToObject(item, "content_url",
          ("/api/v1/sounds/content?path=" + urlEncode("/bells/" + display_name)).c_str());
      cJSON_AddItemToArray(list, item);
    }
    const auto festival = config_.soundManifest().find("festival/current");
    if (!internal_only && festival != config_.soundManifest().end() && !festival->second.file_path.empty()) {
      struct stat info = {};
      std::string extension;
      if (stat(festival->second.file_path.c_str(), &info) == 0 && S_ISREG(info.st_mode) &&
          hasAudioExtension(festival->second.file_path, &extension)) {
        cJSON* item = cJSON_CreateObject();
        cJSON_AddStringToObject(item, "id", "festival/current");
        cJSON_AddStringToObject(item, "name", "Festival slot");
        cJSON_AddStringToObject(item, "format", extension.c_str());
        cJSON_AddStringToObject(item, "source", "festival-slot");
        cJSON_AddNumberToObject(item, "bytes", static_cast<double>(info.st_size));
        uint64_t duration_ms = 0;
        if (cachedMediaDuration(festival->second.file_path, extension, info, &duration_ms)) {
          cJSON_AddNumberToObject(item, "duration", static_cast<double>(duration_ms) / 1000.0);
        } else {
          cJSON_AddNullToObject(item, "duration");
        }
        cJSON_AddStringToObject(item, "content_url", "/api/v1/festival/content");
        cJSON_AddItemToArray(list, item);
      }
    }
  }
  return sendJsonObject(req, root);
}

esp_err_t WebService::browseBellFolder(httpd_req_t* req) {
  if (!storage_.sdReady()) return sendError(req, "409 Conflict", "SD card is not ready");
  std::string requested_path = "/bells";
  std::string query_path;
  if (queryValue(req, "path", &query_path)) requested_path = query_path;
  while (requested_path.size() > 6 && requested_path.back() == '/') requested_path.pop_back();
  if (!safeBellPath(requested_path)) return sendError(req, "400 Bad Request", "path must remain inside /bells");

  size_t offset = 0;
  size_t limit = 50;
  std::string text_value;
  if (queryValue(req, "offset", &text_value)) offset = std::strtoul(text_value.c_str(), nullptr, 10);
  if (queryValue(req, "limit", &text_value)) limit = std::clamp<size_t>(std::strtoul(text_value.c_str(), nullptr, 10), 1, 100);

  const std::string directory = storage_.sdRootPath() + requested_path;
  struct stat directory_info = {};
  if (stat(directory.c_str(), &directory_info) != 0 || !S_ISDIR(directory_info.st_mode)) {
    return sendError(req, "404 Not Found", "bell folder not found");
  }

  struct BrowserEntry {
    std::string name;
    std::string path;
    std::string extension;
    bool folder = false;
    size_t bytes = 0;
  };
  std::vector<BrowserEntry> entries;
  DIR* handle = opendir(directory.c_str());
  if (handle == nullptr) return sendError(req, "500 Internal Server Error", "bell folder cannot be opened");
  while (const dirent* entry = readdir(handle)) {
    const std::string name = entry->d_name;
    if (name == "." || name == ".." || name.empty() || name.front() == '.') continue;
    const std::string full_path = directory + "/" + name;
    struct stat info = {};
    if (stat(full_path.c_str(), &info) != 0) continue;
    if (S_ISDIR(info.st_mode)) {
      entries.push_back(BrowserEntry{name, requested_path + "/" + name, "", true, 0});
      continue;
    }
    std::string extension;
    if (S_ISREG(info.st_mode) && hasAudioExtension(name, &extension)) {
      entries.push_back(BrowserEntry{name, requested_path + "/" + name, extension,
                                     false, static_cast<size_t>(info.st_size)});
    }
  }
  closedir(handle);
  std::sort(entries.begin(), entries.end(), [](const BrowserEntry& left, const BrowserEntry& right) {
    if (left.folder != right.folder) return left.folder > right.folder;
    std::string left_name = left.name;
    std::string right_name = right.name;
    std::transform(left_name.begin(), left_name.end(), left_name.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    std::transform(right_name.begin(), right_name.end(), right_name.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return left_name < right_name;
  });

  cJSON* root = cJSON_CreateObject();
  cJSON_AddStringToObject(root, "path", requested_path.c_str());
  if (requested_path == "/bells") {
    cJSON_AddNullToObject(root, "parent");
  } else {
    const size_t slash = requested_path.find_last_of('/');
    cJSON_AddStringToObject(root, "parent", slash <= 6 ? "/bells" : requested_path.substr(0, slash).c_str());
  }
  cJSON_AddNumberToObject(root, "offset", static_cast<double>(offset));
  cJSON_AddNumberToObject(root, "limit", static_cast<double>(limit));
  cJSON_AddNumberToObject(root, "total", static_cast<double>(entries.size()));
  cJSON* list = cJSON_AddArrayToObject(root, "entries");
  const size_t end = std::min(entries.size(), offset + limit);
  for (size_t index = std::min(offset, entries.size()); index < end; ++index) {
    const BrowserEntry& entry = entries[index];
    cJSON* item = cJSON_CreateObject();
    cJSON_AddStringToObject(item, "name", entry.name.c_str());
    cJSON_AddStringToObject(item, "path", entry.path.c_str());
    cJSON_AddStringToObject(item, "type", entry.folder ? "folder" : "audio");
    if (!entry.folder) {
      const std::string relative = entry.path.substr(std::strlen("/bells/"));
      const std::string sound_id = "bells/" + relative;
      cJSON_AddStringToObject(item, "sound_id", sound_id.c_str());
      cJSON_AddStringToObject(item, "format", entry.extension.c_str());
      cJSON_AddNumberToObject(item, "bytes", static_cast<double>(entry.bytes));
      uint64_t duration_ms = 0;
      struct stat media_info = {};
      const std::string media_path = storage_.sdRootPath() + entry.path;
      if (stat(media_path.c_str(), &media_info) == 0 &&
          cachedMediaDuration(media_path, entry.extension, media_info, &duration_ms)) {
        cJSON_AddNumberToObject(item, "duration", static_cast<double>(duration_ms) / 1000.0);
      } else {
        cJSON_AddNullToObject(item, "duration");
      }
      cJSON_AddStringToObject(item, "content_url",
                              ("/api/v1/sounds/content?path=" + urlEncode(entry.path)).c_str());
    }
    cJSON_AddItemToArray(list, item);
  }
  cJSON_AddBoolToObject(root, "has_more", end < entries.size());
  return sendJsonObject(req, root);
}

esp_err_t WebService::streamSound(httpd_req_t* req) {
  if (!storage_.isReady()) return sendError(req, "409 Conflict", "internal flash is not ready");
  std::string file_name;
  std::string requested_path;
  const bool path_requested = queryValue(req, "path", &requested_path);
  if (path_requested) {
    if (!safeBellPath(requested_path) || requested_path == "/bells") {
      return sendError(req, "400 Bad Request", "valid /bells audio path is required");
    }
    file_name = requested_path.substr(requested_path.find_last_of('/') + 1);
  } else if (!queryValue(req, "name", &file_name) || !safeFileName(file_name)) {
    return sendError(req, "400 Bad Request", "valid name or /bells path query parameter is required");
  }

  std::string extension;
  if (!hasAudioExtension(file_name, &extension)) return sendError(req, "415 Unsupported Media Type", "unsupported sound format");
  if (path_requested && !storage_.sdReady()) return sendError(req, "409 Conflict", "SD card is not ready");
  const std::string path = path_requested ? storage_.sdRootPath() + requested_path
                                          : storage_.rootPath() + "/sounds/" + file_name;
  FILE* file = std::fopen(path.c_str(), "rb");
  if (file == nullptr) return sendError(req, "404 Not Found", "sound file not found");

  setCors(req);
  httpd_resp_set_type(req, extension == "mp3" ? "audio/mpeg" : "audio/wav");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");
  httpd_resp_set_hdr(req, "Content-Disposition", "inline");

  std::array<char, 4096> buffer = {};
  esp_err_t result = ESP_OK;
  while (result == ESP_OK) {
    const size_t count = std::fread(buffer.data(), 1, buffer.size(), file);
    if (count > 0) result = httpd_resp_send_chunk(req, buffer.data(), count);
    if (count < buffer.size()) {
      if (std::ferror(file)) result = ESP_FAIL;
      break;
    }
  }
  std::fclose(file);
  if (result == ESP_OK) result = httpd_resp_send_chunk(req, nullptr, 0);
  return result;
}

esp_err_t WebService::deleteSound(httpd_req_t* req) {
  if (!storage_.isReady()) return sendError(req, "409 Conflict", "internal flash is not ready");
  std::string file_name;
  if (!queryValue(req, "name", &file_name) || !safeFileName(file_name)) return sendError(req, "400 Bad Request", "valid name query parameter is required");
  const std::string sound_id = soundIdFromFile(file_name);
  for (const ScheduleProfile& profile : schedules_.profiles()) {
    for (const ScheduleEntry& entry : profile.schedules) {
      if (entry.sound_id == sound_id) return sendError(req, "409 Conflict", "sound is referenced by a schedule");
    }
  }
  std::string preset_raw;
  if (storage_.readText(app::config::kBellPresetsPath, &preset_raw) == ESP_OK) {
    cJSON* presets = cJSON_Parse(preset_raw.c_str());
    const cJSON* preset = nullptr;
    cJSON_ArrayForEach(preset, presets) {
      const cJSON* value = cJSON_IsObject(preset) ? cJSON_GetObjectItemCaseSensitive(preset, "sound_id") : nullptr;
      if (!cJSON_IsString(value) && cJSON_IsObject(preset)) value = cJSON_GetObjectItemCaseSensitive(preset, "sound");
      if (cJSON_IsString(value) && sound_id == value->valuestring) {
        cJSON_Delete(presets);
        return sendError(req, "409 Conflict", "sound is referenced by a bell preset");
      }
    }
    cJSON_Delete(presets);
  }
  const std::string directory = storage_.rootPath() + "/sounds";
  const std::string path = directory + "/" + file_name;
  if (!storage_.exists(path)) return sendError(req, "404 Not Found", "sound file not found");
  size_t alternatives = 0;
  DIR* handle = opendir(directory.c_str());
  if (handle != nullptr) {
    while (const dirent* entry = readdir(handle)) {
      const std::string other = entry->d_name;
      if (other != file_name && hasAudioExtension(other)) ++alternatives;
    }
    closedir(handle);
  }
  if (alternatives == 0) return sendError(req, "409 Conflict", "at least one sound must remain");
  const std::string temporary = path + ".deleting";
  if (std::rename(path.c_str(), temporary.c_str()) != 0) return sendError(req, "500 Internal Server Error", "sound delete failed");
  const esp_err_t unregister_result = config_.unregisterSoundFile(sound_id);
  if (unregister_result != ESP_OK && unregister_result != ESP_ERR_NOT_FOUND) {
    std::rename(temporary.c_str(), path.c_str());
    return sendError(req, "500 Internal Server Error", "sound manifest update failed");
  }
  std::remove(temporary.c_str());
  audio_.setSoundManifest(config_.soundManifest());
  cJSON* response = cJSON_CreateObject();
  cJSON_AddBoolToObject(response, "ok", true);
  cJSON_AddStringToObject(response, "id", sound_id.c_str());
  return sendJsonObject(req, response);
}

esp_err_t WebService::processRing(httpd_req_t* req) {
  std::string body;
  const esp_err_t read_result = readBody(req, app::config::kMaxRingRequestBytes, &body);
  if (read_result == ESP_ERR_INVALID_SIZE) return sendError(req, "413 Payload Too Large", "ring request too large");
  if (read_result != ESP_OK) return sendError(req, "400 Bad Request", "body read failed");
  RingRequest ring_request;
  if (!body.empty()) {
    cJSON* root = cJSON_Parse(body.c_str());
    if (!cJSON_IsObject(root)) {
      cJSON_Delete(root);
      return sendError(req, "400 Bad Request", "invalid JSON body");
    }
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(root, "name"); cJSON_IsString(value)) ring_request.name = value->valuestring;
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(root, "soundId"); cJSON_IsString(value)) ring_request.sound_id = value->valuestring;
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(root, "duration"); cJSON_IsNumber(value)) ring_request.duration_seconds = static_cast<uint32_t>(std::clamp(value->valuedouble, 0.0, static_cast<double>(app::config::kMaxBellDurationSeconds)));
    cJSON_Delete(root);
  }
  ring_request.trigger_source = "web";
  const esp_err_t result = ring_handler_ ? ring_handler_(ring_request) : ESP_ERR_INVALID_STATE;
  if (result == ESP_OK) return sendJson(req, "{\"ok\":true}");
  const std::string message = "ring failed for '" + ring_request.sound_id + "': " + esp_err_to_name(result);
  return sendError(req, "500 Internal Server Error", message.c_str());
}

esp_err_t WebService::playDiagnosticTone(httpd_req_t* req) {
  const esp_err_t result = audio_.playDiagnosticTone();
  return result == ESP_OK
             ? sendJson(req, "{\"ok\":true,\"frequency_hz\":1000,\"duration_ms\":2000}")
             : sendError(req, "500 Internal Server Error", "diagnostic tone failed");
}

esp_err_t WebService::updateTime(httpd_req_t* req) {
  std::string body;
  if (readBody(req, 256, &body) != ESP_OK) return sendError(req, "400 Bad Request", "body read failed");
  cJSON* root = cJSON_Parse(body.c_str());
  const cJSON* value = cJSON_IsObject(root) ? cJSON_GetObjectItemCaseSensitive(root, "local_time") : nullptr;
  if (!cJSON_IsString(value)) {
    cJSON_Delete(root);
    return sendError(req, "400 Bad Request", "local_time is required");
  }
  int year = 0, month = 0, day = 0, hour = 0, minute = 0, second = 0;
  const int fields = std::sscanf(value->valuestring, "%d-%d-%dT%d:%d:%d", &year, &month, &day, &hour, &minute, &second);
  cJSON_Delete(root);
  if (fields < 5 || year < 2024 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return sendError(req, "400 Bad Request", "invalid local_time");
  std::tm local = {};
  local.tm_year = year - 1900; local.tm_mon = month - 1; local.tm_mday = day;
  local.tm_hour = hour; local.tm_min = minute; local.tm_sec = second; local.tm_isdst = -1;
  if (time_.setLocalTime(local) != ESP_OK) return sendError(req, "500 Internal Server Error", "RTC update failed");
  return sendJson(req, "{\"ok\":true}");
}

esp_err_t WebService::formatSd(httpd_req_t* req) {
  std::string body;
  if (readBody(req, 128, &body) != ESP_OK) return sendError(req, "400 Bad Request", "body read failed");
  cJSON* root = cJSON_Parse(body.c_str());
  const cJSON* confirm = cJSON_IsObject(root) ? cJSON_GetObjectItemCaseSensitive(root, "confirm") : nullptr;
  const bool confirmed = cJSON_IsString(confirm) && std::strcmp(confirm->valuestring, "FORMAT") == 0;
  cJSON_Delete(root);
  if (!confirmed) return sendError(req, "400 Bad Request", "confirm must equal FORMAT");
  if (storage_.formatFat32() != ESP_OK) return sendError(req, "500 Internal Server Error", "SD FAT32 format failed");
  mkdir((storage_.sdRootPath() + "/bells").c_str(), 0775);
  config_.refreshBellLibrary();
  audio_.setSoundManifest(config_.soundManifest());
  cJSON* response = cJSON_CreateObject();
  cJSON_AddBoolToObject(response, "ok", true);
  cJSON_AddStringToObject(response, "filesystem", "FAT32");
  return sendJsonObject(req, response);
}

esp_err_t WebService::uploadSound(httpd_req_t* req) {
  if (!storage_.isReady()) return sendError(req, "409 Conflict", "internal flash is not ready");
  const size_t content_length = req->content_len > 0 ? static_cast<size_t>(req->content_len) : 0U;
  if (content_length == 0 || content_length > app::config::kMaxAudioUploadBytes) return sendError(req, "413 Payload Too Large", "audio must be between 1 byte and 64 MiB");
  size_t total_bytes = 0;
  size_t used_bytes = 0;
  if (storage_.internalInfo(&total_bytes, &used_bytes) != ESP_OK ||
      content_length + 64U * 1024U > total_bytes - used_bytes) {
    return sendError(req, "507 Insufficient Storage", "not enough internal flash space");
  }
  std::string file_name;
  if (!queryValue(req, "name", &file_name)) return sendError(req, "400 Bad Request", "name query parameter is required");
  if (!safeFileName(file_name)) return sendError(req, "400 Bad Request", "unsafe or unsupported file name");
  const std::string path = storage_.rootPath() + "/sounds/" + file_name;
  utils::ensureDirectoryForFile(path);
  FILE* file = std::fopen(path.c_str(), "wb");
  if (file == nullptr) return sendError(req, "500 Internal Server Error", "cannot create sound file");
  std::vector<uint8_t> buffer(8192);
  size_t remaining = content_length;
  bool failed = false;
  while (remaining > 0) {
    const size_t wanted = std::min(remaining, buffer.size());
    const int count = httpd_req_recv(req, reinterpret_cast<char*>(buffer.data()), wanted);
    if (count == HTTPD_SOCK_ERR_TIMEOUT) continue;
    if (count <= 0 || std::fwrite(buffer.data(), 1, static_cast<size_t>(count), file) != static_cast<size_t>(count)) { failed = true; break; }
    remaining -= static_cast<size_t>(count);
  }
  std::fclose(file);
  if (failed || remaining != 0) {
    std::remove(path.c_str());
    return sendError(req, "500 Internal Server Error", "sound upload failed");
  }
  const std::string sound_id = soundIdFromFile(file_name);
  if (config_.registerSoundFile(file_name, sound_id) != ESP_OK) return sendError(req, "500 Internal Server Error", "sound manifest update failed");
  audio_.setAudioProfiles(config_.audioProfiles());
  audio_.setSoundManifest(config_.soundManifest());
  cJSON* response = cJSON_CreateObject();
  cJSON_AddBoolToObject(response, "ok", true);
  cJSON_AddStringToObject(response, "id", sound_id.c_str());
  cJSON_AddStringToObject(response, "name", file_name.c_str());
  cJSON_AddNumberToObject(response, "bytes", static_cast<double>(content_length));
  uint64_t duration_ms = 0;
  std::string uploaded_extension;
  hasAudioExtension(file_name, &uploaded_extension);
  struct stat uploaded_info = {};
  if (stat(path.c_str(), &uploaded_info) == 0 &&
      cachedMediaDuration(path, uploaded_extension, uploaded_info, &duration_ms)) {
    cJSON_AddNumberToObject(response, "duration", static_cast<double>(duration_ms) / 1000.0);
  } else {
    cJSON_AddNullToObject(response, "duration");
  }
  return sendJsonObject(req, response);
}

esp_err_t WebService::renderFestival(httpd_req_t* req) {
  cJSON* root = cJSON_CreateObject();
  cJSON_AddStringToObject(root, "sound_id", "festival/current");
  cJSON_AddStringToObject(root, "storage", "internal-flash");
  const std::string wav_path = std::string(app::config::kFestivalDirectory) + "/current.wav";
  const std::string mp3_path = std::string(app::config::kFestivalDirectory) + "/current.mp3";
  const std::string path = storage_.exists(wav_path) ? wav_path :
                           (storage_.exists(mp3_path) ? mp3_path : "");
  if (path.empty()) {
    cJSON_AddNullToObject(root, "file");
    return sendJsonObject(req, root);
  }
  struct stat info = {};
  stat(path.c_str(), &info);
  const std::string extension = path.size() >= 4 ? path.substr(path.size() - 3) : "";
  cJSON* file = cJSON_AddObjectToObject(root, "file");
  cJSON_AddStringToObject(file, "name", ("current." + extension).c_str());
  cJSON_AddStringToObject(file, "format", extension.c_str());
  cJSON_AddNumberToObject(file, "bytes", static_cast<double>(info.st_size));
  uint64_t duration_ms = 0;
  if (cachedMediaDuration(path, extension, info, &duration_ms)) {
    cJSON_AddNumberToObject(file, "duration", static_cast<double>(duration_ms) / 1000.0);
  } else {
    cJSON_AddNullToObject(file, "duration");
  }
  cJSON_AddStringToObject(file, "content_url", "/api/v1/festival/content");
  return sendJsonObject(req, root);
}

esp_err_t WebService::uploadFestival(httpd_req_t* req) {
  if (!storage_.isReady()) return sendError(req, "409 Conflict", "internal flash is not ready");
  const size_t content_length = req->content_len > 0 ? static_cast<size_t>(req->content_len) : 0U;
  if (content_length == 0 || content_length > app::config::kMaxAudioUploadBytes) {
    return sendError(req, "413 Payload Too Large", "festival audio must be between 1 byte and 64 MiB");
  }
  std::string file_name;
  if (!queryValue(req, "name", &file_name) || !safeFileName(file_name)) {
    return sendError(req, "400 Bad Request", "safe MP3/WAV name query parameter is required");
  }
  std::string extension;
  hasAudioExtension(file_name, &extension);
  size_t total_bytes = 0;
  size_t used_bytes = 0;
  if (storage_.internalInfo(&total_bytes, &used_bytes) != ESP_OK ||
      content_length + 64U * 1024U > total_bytes - used_bytes) {
    return sendError(req, "507 Insufficient Storage", "not enough internal flash space");
  }

  const std::string incoming = std::string(app::config::kFestivalDirectory) + "/incoming." + extension;
  const std::string destination = std::string(app::config::kFestivalDirectory) + "/current." + extension;
  utils::ensureDirectoryForFile(incoming);
  FILE* file = std::fopen(incoming.c_str(), "wb");
  if (file == nullptr) return sendError(req, "500 Internal Server Error", "cannot create festival slot");
  std::vector<uint8_t> buffer(8192);
  size_t remaining = content_length;
  bool failed = false;
  while (remaining > 0) {
    const size_t wanted = std::min(remaining, buffer.size());
    const int count = httpd_req_recv(req, reinterpret_cast<char*>(buffer.data()), wanted);
    if (count == HTTPD_SOCK_ERR_TIMEOUT) continue;
    if (count <= 0 || std::fwrite(buffer.data(), 1, static_cast<size_t>(count), file) != static_cast<size_t>(count)) {
      failed = true;
      break;
    }
    remaining -= static_cast<size_t>(count);
  }
  std::fclose(file);
  if (failed || remaining != 0) {
    std::remove(incoming.c_str());
    return sendError(req, "500 Internal Server Error", "festival upload failed");
  }

  std::remove((std::string(app::config::kFestivalDirectory) + "/current.wav").c_str());
  std::remove((std::string(app::config::kFestivalDirectory) + "/current.mp3").c_str());
  if (std::rename(incoming.c_str(), destination.c_str()) != 0) {
    std::remove(incoming.c_str());
    return sendError(req, "500 Internal Server Error", "festival slot activation failed");
  }
  if (config_.registerSoundPath(destination, "festival/current") != ESP_OK) {
    std::remove(destination.c_str());
    return sendError(req, "500 Internal Server Error", "festival manifest update failed");
  }
  audio_.setAudioProfiles(config_.audioProfiles());
  audio_.setSoundManifest(config_.soundManifest());
  cJSON* response = cJSON_CreateObject();
  cJSON_AddBoolToObject(response, "ok", true);
  cJSON_AddStringToObject(response, "sound_id", "festival/current");
  cJSON_AddStringToObject(response, "name", file_name.c_str());
  cJSON_AddNumberToObject(response, "bytes", static_cast<double>(content_length));
  return sendJsonObject(req, response);
}

esp_err_t WebService::streamFestival(httpd_req_t* req) {
  const std::string wav_path = std::string(app::config::kFestivalDirectory) + "/current.wav";
  const std::string mp3_path = std::string(app::config::kFestivalDirectory) + "/current.mp3";
  const bool wav = storage_.exists(wav_path);
  const std::string path = wav ? wav_path : (storage_.exists(mp3_path) ? mp3_path : "");
  if (path.empty()) return sendError(req, "404 Not Found", "festival slot is empty");
  FILE* file = std::fopen(path.c_str(), "rb");
  if (file == nullptr) return sendError(req, "404 Not Found", "festival file not found");
  setCors(req);
  httpd_resp_set_type(req, wav ? "audio/wav" : "audio/mpeg");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");
  httpd_resp_set_hdr(req, "Content-Disposition", "inline");
  std::array<char, 4096> buffer = {};
  esp_err_t result = ESP_OK;
  while (result == ESP_OK) {
    const size_t count = std::fread(buffer.data(), 1, buffer.size(), file);
    if (count > 0) result = httpd_resp_send_chunk(req, buffer.data(), count);
    if (count < buffer.size()) {
      if (std::ferror(file)) result = ESP_FAIL;
      break;
    }
  }
  std::fclose(file);
  return result == ESP_OK ? httpd_resp_send_chunk(req, nullptr, 0) : result;
}

esp_err_t WebService::clearFestival(httpd_req_t* req) {
  for (const ScheduleProfile& profile : schedules_.profiles()) {
    for (const ScheduleEntry& entry : profile.schedules) {
      if (entry.sound_id == "festival/current") {
        return sendError(req, "409 Conflict", "festival sound is referenced by a schedule");
      }
    }
  }
  const std::string wav_path = std::string(app::config::kFestivalDirectory) + "/current.wav";
  const std::string mp3_path = std::string(app::config::kFestivalDirectory) + "/current.mp3";
  const bool existed = storage_.exists(wav_path) || storage_.exists(mp3_path);
  if (!existed) return sendError(req, "404 Not Found", "festival slot is already empty");
  const esp_err_t manifest_result = config_.unregisterSoundFile("festival/current");
  if (manifest_result != ESP_OK && manifest_result != ESP_ERR_NOT_FOUND) {
    return sendError(req, "500 Internal Server Error", "festival manifest update failed");
  }
  std::remove(wav_path.c_str());
  std::remove(mp3_path.c_str());
  audio_.setSoundManifest(config_.soundManifest());
  return sendJson(req, "{\"ok\":true,\"cleared\":true}");
}

}  // namespace app::services
