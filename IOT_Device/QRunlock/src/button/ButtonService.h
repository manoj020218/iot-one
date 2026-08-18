#pragma once

#include <Arduino.h>

#include "button/ButtonLogic.h"

namespace button {

class ButtonService {
 public:
  void Begin(uint8_t pin, bool activeLow);
  ButtonEvent Tick(uint32_t nowMs);

 private:
  uint8_t pin_ = 0;
  bool activeLow_ = true;
  bool enabled_ = false;
  ButtonLogic logic_{};
};

}  // namespace button
