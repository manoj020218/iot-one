#pragma once
/*
  JenixLedStatus.h
  ------------------------------------------------------------
  Standard WS2812 / NeoPixel status LED library for Jenix ONE
  IoT devices.

  Target:
    ESP32-C3 / ESP32-S3 / ESP32-P4 (Arduino framework)

  Dependency:
    None beyond the Arduino-ESP32 core itself -- drives the pixel via the
    core's own built-in neopixelWrite() (esp32-hal-rgb-led.h), the same
    helper the core uses for RGB_BUILTIN boards. Deliberately not the
    Adafruit_NeoPixel library: its RMT-based esp.c backend assumes a
    specific arduino-esp32 core RMT API shape that a pinned/patched core
    (e.g. a mixed arduino+espidf provisioning build pinned to a specific
    ESP-IDF version) may not match, while neopixelWrite() is part of the
    core itself and always matches whatever core it ships with.

  Usage:
    #include "JenixLedStatus.h"

    JenixLedStatus led(8);   // WS2812 data GPIO

    void setup() {
      led.begin();
      led.setState(JenixLedState::BOOTING);
    }

    void loop() {
      led.update();          // call continuously; non-blocking
    }

  Notes:
    - Designed for one WS2812 RGB LED.
    - All animations are non-blocking.
    - Call update() frequently from loop().
    - Normal LED brightness defaults to 20%.
*/

#include <Arduino.h>
#include <esp32-hal-rgb-led.h>

enum class JenixLedState : uint8_t {
  OFF = 0,

  // System
  BOOTING,
  IDENTIFY,
  FACTORY_RESET_COUNTDOWN,
  FACTORY_RESET_DONE,

  // Provisioning / Connectivity
  UNPROVISIONED,
  BLE_PROVISIONING,
  AP_PROVISIONING,
  CREDENTIALS_RECEIVED,
  WIFI_CONNECTING,
  WIFI_DISCONNECTED,
  WIFI_CONNECTED_CLOUD_CONNECTING,
  CONNECTED,

  // Device status
  WARNING,
  CRITICAL_FAULT,

  // Generic "actively performing its core physical action" indicator --
  // printing a token, dispensing, pumping, etc. Product-specific meaning,
  // shared pattern: fast white blink says "working", distinct from
  // WIFI_CONNECTING/OTA's own animations so a user can't confuse "the
  // network is doing something" with "the device itself is busy".
  BUSY,

  // OTA
  OTA_DOWNLOADING,
  OTA_INSTALLING,
  OTA_SUCCESS,
  OTA_FAILED
};

class JenixLedStatus {
public:
  explicit JenixLedStatus(
      uint8_t pin,
      uint8_t brightness = 51)   // ~20%
      : _pin(pin),
        _brightness(brightness) {}

  void begin() {
    neopixelWrite(_pin, 0, 0, 0);

    _state = JenixLedState::OFF;
    _previousState = JenixLedState::OFF;
    _lastTick = millis();
    _step = 0;
  }

  void setBrightness(uint8_t brightness) {
    _brightness = brightness;
  }

  uint8_t getBrightness() const {
    return _brightness;
  }

  void setState(JenixLedState state) {
    if (_state == state) return;

    _previousState = _state;
    _state = state;
    _step = 0;
    _lastTick = millis();
    _pulseValue = 0;
    _pulseDirection = 1;

    renderImmediateState();
  }

  JenixLedState getState() const {
    return _state;
  }

  JenixLedState getPreviousState() const {
    return _previousState;
  }

  void off() {
    setState(JenixLedState::OFF);
  }

  // Call continuously from loop()
  void update() {
    const uint32_t now = millis();

    switch (_state) {

      case JenixLedState::OFF:
        break;

      case JenixLedState::BOOTING:
        // Solid white. Firmware should change state when boot completes.
        setColor(WHITE);
        break;

      case JenixLedState::IDENTIFY:
        breathe(CYAN, now, 12);
        break;

      case JenixLedState::FACTORY_RESET_COUNTDOWN:
        blink(RED, now, 150);
        break;

      case JenixLedState::FACTORY_RESET_DONE:
        flashSequence(WHITE, now, 180, 3, true);
        break;

      case JenixLedState::UNPROVISIONED:
      case JenixLedState::BLE_PROVISIONING:
        blink(BLUE, now, 250);
        break;

      case JenixLedState::AP_PROVISIONING:
        blink(PURPLE, now, 250);
        break;

      case JenixLedState::CREDENTIALS_RECEIVED:
        flashSequence(YELLOW, now, 140, 3, false);
        break;

      case JenixLedState::WIFI_CONNECTING:
        breathe(YELLOW, now, 8);
        break;

      case JenixLedState::WIFI_DISCONNECTED:
        blink(BLUE, now, 1000);
        break;

      case JenixLedState::WIFI_CONNECTED_CLOUD_CONNECTING:
        blink(CYAN, now, 350);
        break;

      case JenixLedState::CONNECTED:
        setColor(GREEN);
        break;

      case JenixLedState::WARNING:
        blink(ORANGE, now, 900);
        break;

      case JenixLedState::CRITICAL_FAULT:
        blink(RED, now, 180);
        break;

      case JenixLedState::BUSY:
        blink(WHITE, now, 90);
        break;

      case JenixLedState::OTA_DOWNLOADING:
        breathe(PURPLE, now, 7);
        break;

      case JenixLedState::OTA_INSTALLING:
        alternate(PURPLE, WHITE, now, 300);
        break;

      case JenixLedState::OTA_SUCCESS:
        flashSequence(GREEN, now, 120, 5, true);
        break;

      case JenixLedState::OTA_FAILED:
        alternate(RED, PURPLE, now, 250);
        break;
    }
  }

  // Useful for firmware code that wants a temporary visual acknowledgement.
  void showColor(uint8_t r, uint8_t g, uint8_t b) {
    writeScaled(r, g, b);
  }

private:
  struct RGB {
    uint8_t r;
    uint8_t g;
    uint8_t b;
  };

  uint8_t _pin;

  JenixLedState _state = JenixLedState::OFF;
  JenixLedState _previousState = JenixLedState::OFF;

  uint8_t _brightness = 51;

  uint32_t _lastTick = 0;
  uint16_t _step = 0;

  int16_t _pulseValue = 0;
  int8_t _pulseDirection = 1;

  // ----------------------------------------------------------
  // Jenix ONE Standard Colors
  // ----------------------------------------------------------

  static constexpr RGB OFF_COLOR = {0, 0, 0};
  static constexpr RGB WHITE      = {255, 255, 255};
  static constexpr RGB GREEN      = {0, 255, 0};
  static constexpr RGB BLUE       = {0, 70, 255};
  static constexpr RGB CYAN       = {0, 255, 255};
  static constexpr RGB YELLOW     = {255, 180, 0};
  static constexpr RGB ORANGE     = {255, 70, 0};
  static constexpr RGB RED        = {255, 0, 0};
  static constexpr RGB PURPLE     = {160, 0, 255};

  void renderImmediateState() {
    switch (_state) {
      case JenixLedState::OFF:
        setColor(OFF_COLOR);
        break;

      case JenixLedState::BOOTING:
        setColor(WHITE);
        break;

      case JenixLedState::CONNECTED:
        setColor(GREEN);
        break;

      default:
        // Dynamic states are rendered by update()
        setColor(OFF_COLOR);
        break;
    }
  }

  // Applies _brightness on top of the caller's already-scaled 0-255 value --
  // neopixelWrite() has no separate brightness concept of its own, unlike
  // Adafruit_NeoPixel's setBrightness()/show(), so every write goes through
  // this one place instead.
  void writeScaled(uint8_t r, uint8_t g, uint8_t b) {
    neopixelWrite(
        _pin,
        static_cast<uint16_t>(r) * _brightness / 255,
        static_cast<uint16_t>(g) * _brightness / 255,
        static_cast<uint16_t>(b) * _brightness / 255);
  }

  void setColor(const RGB &color) {
    writeScaled(color.r, color.g, color.b);
  }

  void setScaledColor(const RGB &color, uint8_t scale) {
    const uint8_t r =
        static_cast<uint16_t>(color.r) * scale / 255;
    const uint8_t g =
        static_cast<uint16_t>(color.g) * scale / 255;
    const uint8_t b =
        static_cast<uint16_t>(color.b) * scale / 255;

    writeScaled(r, g, b);
  }

  void blink(
      const RGB &color,
      uint32_t now,
      uint32_t intervalMs) {

    if (now - _lastTick < intervalMs) return;
    _lastTick = now;

    _step ^= 1;

    if (_step) {
      setColor(color);
    } else {
      setColor(OFF_COLOR);
    }
  }

  void alternate(
      const RGB &first,
      const RGB &second,
      uint32_t now,
      uint32_t intervalMs) {

    if (now - _lastTick < intervalMs) return;
    _lastTick = now;

    _step ^= 1;

    if (_step) {
      setColor(first);
    } else {
      setColor(second);
    }
  }

  void breathe(
      const RGB &color,
      uint32_t now,
      uint8_t speed) {

    constexpr uint32_t intervalMs = 20;

    if (now - _lastTick < intervalMs) return;
    _lastTick = now;

    _pulseValue += _pulseDirection * speed;

    if (_pulseValue >= 255) {
      _pulseValue = 255;
      _pulseDirection = -1;
    } else if (_pulseValue <= 8) {
      _pulseValue = 8;
      _pulseDirection = 1;
    }

    setScaledColor(
        color,
        static_cast<uint8_t>(_pulseValue));
  }

  void flashSequence(
      const RGB &color,
      uint32_t now,
      uint32_t intervalMs,
      uint8_t flashCount,
      bool stayOnAfter) {

    const uint16_t maxSteps = flashCount * 2;

    if (_step >= maxSteps) {
      if (stayOnAfter) {
        setColor(color);
      } else {
        setColor(OFF_COLOR);
      }
      return;
    }

    if (now - _lastTick < intervalMs) return;
    _lastTick = now;

    if ((_step % 2) == 0) {
      setColor(color);
    } else {
      setColor(OFF_COLOR);
    }

    _step++;
  }
};
