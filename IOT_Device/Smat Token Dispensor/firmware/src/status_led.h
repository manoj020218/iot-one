#pragma once

#include <Arduino.h>

enum class StatusLedTriggerSource : uint8_t {
    BUTTON = 0,
    REMOTE = 1,
};

namespace StatusLed {
    void begin();
    void signalTrigger(StatusLedTriggerSource source);
}
