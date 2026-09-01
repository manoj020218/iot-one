#include "event_log.h"
#include <SPIFFS.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <time.h>

#define LOG_FILE        "/events.log"
#define MAX_ENTRIES     200
#define MAX_LINE_LEN    256

static SemaphoreHandle_t s_mutex = nullptr;

static const char* levelStr(LogLevel l) {
    switch (l) {
        case LogLevel::WARN:  return "WARN";
        case LogLevel::ERROR: return "ERROR";
        default:              return "INFO";
    }
}

// Count lines in log file
static int countLines() {
    File f = SPIFFS.open(LOG_FILE, "r");
    if (!f) return 0;
    int count = 0;
    while (f.available()) {
        if (f.read() == '\n') count++;
    }
    f.close();
    return count;
}

// Drop the oldest N lines by rewriting the file
static void dropOldestLines(int n) {
    File src = SPIFFS.open(LOG_FILE, "r");
    if (!src) return;

    // Skip n lines
    int skipped = 0;
    while (skipped < n && src.available()) {
        char c = src.read();
        if (c == '\n') skipped++;
    }

    // Copy rest to a temp file
    File tmp = SPIFFS.open("/events.tmp", "w");
    if (!tmp) { src.close(); return; }
    while (src.available()) {
        tmp.write(src.read());
    }
    src.close();
    tmp.close();

    SPIFFS.remove(LOG_FILE);
    SPIFFS.rename("/events.tmp", LOG_FILE);
}

namespace EventLog {

void begin() {
    s_mutex = xSemaphoreCreateMutex();
    if (!SPIFFS.exists(LOG_FILE)) {
        // Create empty file
        File f = SPIFFS.open(LOG_FILE, "w");
        if (f) f.close();
    }
}

void log(LogLevel level, const char* category, const char* message) {
    if (!s_mutex) return;
    xSemaphoreTake(s_mutex, portMAX_DELAY);

    // Rotate if too many entries
    if (countLines() >= MAX_ENTRIES) {
        dropOldestLines(MAX_ENTRIES / 4);
    }

    char timestamp[32] = "no-time";
    struct tm ti;
    if (getLocalTime(&ti)) {
        strftime(timestamp, sizeof(timestamp), "%Y-%m-%dT%H:%M:%S", &ti);
    }

    char line[MAX_LINE_LEN];
    snprintf(line, sizeof(line),
             "{\"t\":\"%s\",\"l\":\"%s\",\"c\":\"%s\",\"m\":\"%s\"}\n",
             timestamp, levelStr(level), category, message);

    File f = SPIFFS.open(LOG_FILE, "a");
    if (f) {
        f.print(line);
        f.close();
    }

    xSemaphoreGive(s_mutex);

    // Mirror to serial for dev/debug
    Serial.printf("[%s][%s] %s\n", levelStr(level), category, message);
}

size_t readAll(char* buf, size_t maxLen) {
    if (!s_mutex || !buf || maxLen < 3) return 0;
    xSemaphoreTake(s_mutex, portMAX_DELAY);

    File f = SPIFFS.open(LOG_FILE, "r");
    if (!f) {
        xSemaphoreGive(s_mutex);
        buf[0] = '['; buf[1] = ']'; buf[2] = 0;
        return 2;
    }

    // Wrap lines in a JSON array
    size_t written = 0;
    buf[written++] = '[';
    bool first = true;
    char line[MAX_LINE_LEN];

    while (f.available() && written < maxLen - 4) {
        int len = f.readBytesUntil('\n', line, sizeof(line) - 1);
        if (len <= 0) continue;
        line[len] = 0;
        if (strlen(line) < 5) continue; // skip blank/corrupt lines

        size_t entryLen = strlen(line);
        if (written + entryLen + 3 >= maxLen) break;

        if (!first) buf[written++] = ',';
        memcpy(buf + written, line, entryLen);
        written += entryLen;
        first = false;
    }
    f.close();

    buf[written++] = ']';
    buf[written]   = 0;

    xSemaphoreGive(s_mutex);
    return written;
}

void clear() {
    if (!s_mutex) return;
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    SPIFFS.remove(LOG_FILE);
    File f = SPIFFS.open(LOG_FILE, "w");
    if (f) f.close();
    xSemaphoreGive(s_mutex);
}

} // namespace EventLog
