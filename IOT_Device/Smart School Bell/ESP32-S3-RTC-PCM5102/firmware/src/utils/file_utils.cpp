#include "utils/file_utils.h"

#include <sys/stat.h>
#include <sys/types.h>

#include <sstream>

namespace app::utils {

std::string joinPath(const std::string& left, const std::string& right) {
  if (left.empty()) return right;
  if (right.empty()) return left;
  if (left.back() == '/') return left + right;
  return left + "/" + right;
}

bool ensureDirectory(const std::string& path) {
  if (path.empty() || path == "/") return true;

  std::stringstream stream(path);
  std::string segment;
  std::string current = (!path.empty() && path.front() == '/') ? "/" : "";

  while (std::getline(stream, segment, '/')) {
    if (segment.empty()) continue;
    current = joinPath(current, segment);
    ::mkdir(current.c_str(), 0775);
  }
  return true;
}

bool ensureDirectoryForFile(const std::string& file_path) {
  const size_t slash = file_path.find_last_of('/');
  if (slash == std::string::npos) return true;
  return ensureDirectory(file_path.substr(0, slash));
}

}  // namespace app::utils
