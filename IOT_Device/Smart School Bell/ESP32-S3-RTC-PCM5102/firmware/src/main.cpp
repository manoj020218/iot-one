#include "app/app_main.h"

extern "C" void app_main(void) {
  app::FirmwareApp firmware_app;
  firmware_app.run();
}
