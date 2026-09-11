#include "utils/json_utils.h"

namespace app::utils {

cJSON* parseJson(const std::string& text) {
  if (text.empty()) {
    return nullptr;
  }
  return cJSON_Parse(text.c_str());
}

std::string toJsonString(const cJSON* root) {
  if (root == nullptr) {
    return {};
  }

  char* raw = cJSON_PrintUnformatted(root);
  if (raw == nullptr) {
    return {};
  }

  std::string json(raw);
  cJSON_free(raw);
  return json;
}

}  // namespace app::utils
