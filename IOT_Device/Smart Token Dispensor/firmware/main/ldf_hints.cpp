// Direct includes keep PlatformIO's dependency scanner aligned with the
// wrapped source tree under main/.
#include <ArduinoJson.h>
#ifndef JENIX_PROV_V2
#include <ArduinoOTA.h>
#include <ESPmDNS.h>
#endif
#include <ESPAsyncWebServer.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#ifndef JENIX_PROV_V2
#include <NimBLEDevice.h>
#endif
#include <Preferences.h>
#include <PubSubClient.h>
#include <SPIFFS.h>
#include <WiFi.h>
#include <WiFiClient.h>
