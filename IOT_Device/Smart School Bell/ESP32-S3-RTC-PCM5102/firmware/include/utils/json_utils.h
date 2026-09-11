#pragma once

#include <string>

#include "cJSON.h"

namespace app::utils {

cJSON* parseJson(const std::string& text);
std::string toJsonString(const cJSON* root);

}  // namespace app::utils
