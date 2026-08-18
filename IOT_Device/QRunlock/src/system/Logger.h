#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

namespace systemlog {

class Logger {
 public:
  void Info(const String& message);
  void Warn(const String& message);
  void Error(const String& message);
  void FillJson(JsonArray array, size_t limit = 12) const;

 private:
  static constexpr size_t kCapacity = 40;

  struct Entry {
    uint32_t atMs;
    char level[8];
    char message[96];
  };

  void Add(const char* level, const String& message);

  Entry entries_[kCapacity]{};
  size_t next_ = 0;
  size_t count_ = 0;
};

}  // namespace systemlog
