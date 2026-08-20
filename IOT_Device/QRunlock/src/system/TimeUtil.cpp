#include "system/TimeUtil.h"

#include <ctime>

namespace systemtime {
namespace {
constexpr time_t kPlausibleEpoch = 1600000000;  // 2020-09-13, well before any real deploy
}  // namespace

void Begin() { configTime(0, 0, "pool.ntp.org", "time.google.com"); }

bool Synced() { return time(nullptr) > kPlausibleEpoch; }

void NowIso8601(char* out, size_t outSize) {
  const time_t now = time(nullptr);
  struct tm utc {};
  gmtime_r(&now, &utc);
  std::strftime(out, outSize, "%Y-%m-%dT%H:%M:%SZ", &utc);
}

}  // namespace systemtime
