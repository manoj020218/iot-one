#include "paper_estimator.h"
#include "config_store.h"
#include "event_log.h"
#include <Preferences.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

static Preferences       s_prefs;
static SemaphoreHandle_t s_mutex            = nullptr;
static uint32_t          s_tokensSinceReset = 0;

namespace PaperEstimator {

void begin() {
    s_mutex = xSemaphoreCreateMutex();
    load();
}

void load() {
    s_prefs.begin("jnx_pap", true);
    s_tokensSinceReset = s_prefs.getUInt("tokensUsed", 0);
    s_prefs.end();
}

void save() {
    s_prefs.begin("jnx_pap", false);
    s_prefs.putUInt("tokensUsed", s_tokensSinceReset);
    s_prefs.end();
}

void onTokenPrinted() {
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    s_tokensSinceReset++;

    uint32_t perRoll   = ConfigStore::dev().tokensPerRoll;
    uint32_t threshold = ConfigStore::dev().lowPaperThreshold;

    // Save every token; NVS has >100k write endurance per key,
    // and CSN-A1X throughput is low (seconds per ticket).
    s_prefs.begin("jnx_pap", false);
    s_prefs.putUInt("tokensUsed", s_tokensSinceReset);
    s_prefs.end();

    uint32_t left = (s_tokensSinceReset < perRoll)
                    ? (perRoll - s_tokensSinceReset) : 0;

    if (left <= threshold && left + 1 > threshold) {
        // Just crossed the low-paper threshold
        EventLog::warn("PAPER", "Paper roll low — estimated tokens remaining low");
    }

    xSemaphoreGive(s_mutex);
}

void resetRoll() {
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    s_tokensSinceReset = 0;
    s_prefs.begin("jnx_pap", false);
    s_prefs.putUInt("tokensUsed", 0);
    s_prefs.end();
    xSemaphoreGive(s_mutex);
    EventLog::info("PAPER", "Roll counter reset — new roll installed");
}

uint32_t tokensSinceReset() {
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    uint32_t v = s_tokensSinceReset;
    xSemaphoreGive(s_mutex);
    return v;
}

uint32_t estimatedTokensLeft() {
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    uint32_t perRoll = ConfigStore::dev().tokensPerRoll;
    uint32_t left = (s_tokensSinceReset < perRoll)
                    ? (perRoll - s_tokensSinceReset) : 0;
    xSemaphoreGive(s_mutex);
    return left;
}

bool isPaperLow() {
    return estimatedTokensLeft() <= ConfigStore::dev().lowPaperThreshold;
}

} // namespace PaperEstimator
