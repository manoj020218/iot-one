#include "token_manager.h"
#include "config_store.h"
#include "event_log.h"
#include <Preferences.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <time.h>

static Preferences     s_prefs;
static SemaphoreHandle_t s_mutex     = nullptr;
static uint32_t        s_current     = 0;  // next number to assign
static uint32_t        s_lastPrinted = 0;
static char            s_fmtBuf[32];
static char            s_lastFmtBuf[32];
static uint8_t         s_lastResetDay = 0; // tm_mday at last daily reset

static void formatToken(char* buf, size_t len, uint32_t num) {
    const char* prefix = ConfigStore::dev().tokenPrefix;
    if (prefix && strlen(prefix) > 0) {
        snprintf(buf, len, "%s%04" PRIu32, prefix, num);
    } else {
        snprintf(buf, len, "%04" PRIu32, num);
    }
}

static void persistCurrent() {
    s_prefs.begin("jnx_tok", false);
    s_prefs.putUInt("current",     s_current);
    s_prefs.putUInt("lastPrinted", s_lastPrinted);
    s_prefs.end();
}

static void loadFromNvs() {
    s_prefs.begin("jnx_tok", true);
    s_current     = s_prefs.getUInt("current",      0);
    s_lastPrinted = s_prefs.getUInt("lastPrinted",  0);
    s_lastResetDay= s_prefs.getUChar("resetDay",    0);
    s_prefs.end();
}

namespace TokenManager {

void begin() {
    s_mutex = xSemaphoreCreateMutex();
    loadFromNvs();
    formatToken(s_fmtBuf,     sizeof(s_fmtBuf),     s_current);
    formatToken(s_lastFmtBuf, sizeof(s_lastFmtBuf),  s_lastPrinted);

    char msg[64];
    snprintf(msg, sizeof(msg), "Token counter restored: current=%lu lastPrinted=%lu",
             (unsigned long)s_current, (unsigned long)s_lastPrinted);
    EventLog::info("TOKEN", msg);
}

bool requestNextToken() {
    // Caller must hold no lock — we will try to enqueue a print job
    // after incrementing. Returns false if printer is in paper-out error.
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    s_current++;
    formatToken(s_fmtBuf, sizeof(s_fmtBuf), s_current);
    persistCurrent();
    xSemaphoreGive(s_mutex);
    return true;
}

uint32_t peekNextNumber() {
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    uint32_t next = s_current + 1;
    xSemaphoreGive(s_mutex);
    return next;
}

uint32_t currentNumber() {
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    uint32_t v = s_current;
    xSemaphoreGive(s_mutex);
    return v;
}

uint32_t lastPrintedNumber() {
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    uint32_t v = s_lastPrinted;
    xSemaphoreGive(s_mutex);
    return v;
}

const char* currentFormatted() {
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    formatToken(s_fmtBuf, sizeof(s_fmtBuf), s_current);
    xSemaphoreGive(s_mutex);
    return s_fmtBuf;
}

const char* lastPrintedFormatted() {
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    formatToken(s_lastFmtBuf, sizeof(s_lastFmtBuf), s_lastPrinted);
    xSemaphoreGive(s_mutex);
    return s_lastFmtBuf;
}

void confirmPrinted(uint32_t number) {
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    s_lastPrinted = number;
    formatToken(s_lastFmtBuf, sizeof(s_lastFmtBuf), s_lastPrinted);
    persistCurrent();
    xSemaphoreGive(s_mutex);
}

void setCounter(uint32_t value) {
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    s_current     = value;
    s_lastPrinted = (value > 0) ? value - 1 : 0;
    formatToken(s_fmtBuf,     sizeof(s_fmtBuf),     s_current);
    formatToken(s_lastFmtBuf, sizeof(s_lastFmtBuf),  s_lastPrinted);
    persistCurrent();
    xSemaphoreGive(s_mutex);

    char msg[48];
    snprintf(msg, sizeof(msg), "Counter set to %lu", (unsigned long)value);
    EventLog::info("TOKEN", msg);
}

void resetCounter() {
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    s_current     = 0;
    s_lastPrinted = 0;
    formatToken(s_fmtBuf,     sizeof(s_fmtBuf),     0);
    formatToken(s_lastFmtBuf, sizeof(s_lastFmtBuf),  0);
    persistCurrent();
    xSemaphoreGive(s_mutex);
    EventLog::info("TOKEN", "Counter reset to 0");
}

void checkDailyReset() {
    uint32_t resetHour = ConfigStore::dev().dailyResetHour;
    if (resetHour > 23) return; // Disabled

    struct tm ti;
    if (!getLocalTime(&ti)) return;

    // Reset once per day when hour matches and day has changed
    if ((uint32_t)ti.tm_hour == resetHour && (uint8_t)ti.tm_mday != s_lastResetDay) {
        s_lastResetDay = (uint8_t)ti.tm_mday;
        // Persist reset-day before resetting counter (safe ordering)
        s_prefs.begin("jnx_tok", false);
        s_prefs.putUChar("resetDay", s_lastResetDay);
        s_prefs.end();
        resetCounter();
        EventLog::info("TOKEN", "Daily counter reset executed");
    }
}

} // namespace TokenManager
