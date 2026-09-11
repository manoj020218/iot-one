#include <cassert>
#include <ctime>

#include "app_types.h"

namespace {

std::tm date(int year, int month, int day, int weekday) {
  std::tm value{};
  value.tm_year = year - 1900;
  value.tm_mon = month - 1;
  value.tm_mday = day;
  value.tm_wday = weekday;
  return value;
}

}  // namespace

int main() {
  app::CalendarRule winter;
  winter.enabled = true;
  winter.repeat_yearly = true;
  winter.start_date = "2026-11-01";
  winter.end_date = "2027-02-28";
  assert(winter.matches(date(2028, 12, 1, 5)));
  assert(winter.matches(date(2029, 1, 15, 1)));
  assert(!winter.matches(date(2029, 3, 1, 4)));

  app::CalendarRule exam;
  exam.enabled = true;
  exam.start_date = "2027-02-10";
  exam.end_date = "2027-02-25";
  assert(exam.matches(date(2027, 2, 10, 3)));
  assert(exam.matches(date(2027, 2, 25, 4)));
  assert(!exam.matches(date(2027, 2, 26, 5)));

  app::ScheduleEntry bell;
  bell.enabled = true;
  bell.time_hhmm = "08:30";
  bell.days_enabled.fill(false);
  bell.days_enabled[1] = true;
  std::tm monday = date(2027, 2, 15, 1);
  monday.tm_hour = 8;
  monday.tm_min = 30;
  assert(bell.matches(monday));
  monday.tm_min = 31;
  assert(!bell.matches(monday));
}
