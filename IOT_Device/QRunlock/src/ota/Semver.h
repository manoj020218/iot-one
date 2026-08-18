#pragma once

#include <cstdint>

#include <Arduino.h>

namespace ota {

struct Semver {
  int major = 0;
  int minor = 0;
  int patch = 0;
};

inline bool ParseSemver(const String& text, Semver* out) {
  if (out == nullptr) return false;
  int firstDot = text.indexOf('.');
  int secondDot = text.indexOf('.', firstDot + 1);
  if (firstDot <= 0 || secondDot <= firstDot + 1) return false;
  out->major = text.substring(0, firstDot).toInt();
  out->minor = text.substring(firstDot + 1, secondDot).toInt();
  out->patch = text.substring(secondDot + 1).toInt();
  return true;
}

inline int CompareSemver(const String& left, const String& right) {
  Semver a{};
  Semver b{};
  if (!ParseSemver(left, &a) || !ParseSemver(right, &b)) return 0;
  if (a.major != b.major) return a.major < b.major ? -1 : 1;
  if (a.minor != b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch != b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}

}  // namespace ota
