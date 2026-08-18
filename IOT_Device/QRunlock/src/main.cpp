#include "app/AppController.h"

namespace {

app::AppController gApp;

}  // namespace

void setup() { gApp.Begin(); }

void loop() { gApp.Tick(); }
