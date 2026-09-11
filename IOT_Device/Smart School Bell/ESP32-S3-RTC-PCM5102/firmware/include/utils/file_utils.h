#pragma once

#include <string>

namespace app::utils {

std::string joinPath(const std::string& left, const std::string& right);
bool ensureDirectory(const std::string& path);
bool ensureDirectoryForFile(const std::string& file_path);

}  // namespace app::utils
