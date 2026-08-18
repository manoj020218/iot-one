#include "system/Logger.h"

#include <cstring>

namespace systemlog {

void Logger::Info(const String& message) { Add("INFO", message); }
void Logger::Warn(const String& message) { Add("WARN", message); }
void Logger::Error(const String& message) { Add("ERROR", message); }

void Logger::FillJson(JsonArray array, size_t limit) const {
  const size_t emitCount = count_ < limit ? count_ : limit;
  for (size_t index = 0; index < emitCount; ++index) {
    const size_t slot = (next_ + kCapacity - emitCount + index) % kCapacity;
    JsonObject item = array.createNestedObject();
    item["atMs"] = entries_[slot].atMs;
    item["level"] = entries_[slot].level;
    item["message"] = entries_[slot].message;
  }
}

void Logger::Add(const char* level, const String& message) {
  Entry& entry = entries_[next_];
  entry.atMs = millis();
  std::strncpy(entry.level, level, sizeof(entry.level) - 1);
  entry.level[sizeof(entry.level) - 1] = '\0';
  std::strncpy(entry.message, message.c_str(), sizeof(entry.message) - 1);
  entry.message[sizeof(entry.message) - 1] = '\0';
  Serial.printf("[%lu] %s %s\n", static_cast<unsigned long>(entry.atMs), entry.level,
                entry.message);
  next_ = (next_ + 1) % kCapacity;
  if (count_ < kCapacity) ++count_;
}

}  // namespace systemlog
