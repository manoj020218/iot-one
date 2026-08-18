#include <unity.h>

#include "app/AppState.h"
#include "button/ButtonLogic.h"
#include "config/Defaults.h"
#include "relay/RelayLogic.h"
#include "rf/RfLogic.h"

void test_button_timing() {
  button::ButtonLogic logic;
  TEST_ASSERT_EQUAL(button::ButtonEvent::None, logic.Update(0, false));
  TEST_ASSERT_EQUAL(button::ButtonEvent::None, logic.Update(10, true));
  TEST_ASSERT_EQUAL(button::ButtonEvent::None, logic.Update(40, true));
  TEST_ASSERT_EQUAL(button::ButtonEvent::None, logic.Update(60, false));
  TEST_ASSERT_EQUAL(button::ButtonEvent::ShortPress, logic.Update(90, false));
  TEST_ASSERT_EQUAL(button::ButtonEvent::None, logic.Update(100, true));
  TEST_ASSERT_EQUAL(button::ButtonEvent::ProvisioningHold, logic.Update(5200, true));
  TEST_ASSERT_EQUAL(button::ButtonEvent::FactoryResetHold, logic.Update(10250, true));
}

void test_relay_pulse_and_cooldown() {
  relay::RelayLogic logic;
  logic.Configure(1000, 1500);
  TEST_ASSERT_TRUE(logic.RequestPulse(0));
  TEST_ASSERT_TRUE(logic.Active());
  TEST_ASSERT_FALSE(logic.RequestPulse(200));
  TEST_ASSERT_FALSE(logic.Update(999));
  TEST_ASSERT_TRUE(logic.Update(1000));
  TEST_ASSERT_FALSE(logic.Active());
  TEST_ASSERT_FALSE(logic.RequestPulse(2000));
  TEST_ASSERT_TRUE(logic.RequestPulse(2501));
}

void test_rf_trigger_and_learning() {
  rf::RfLogic logic;
  logic.Configure(20, 40, 250, 10000, 250);
  TEST_ASSERT_EQUAL(rf::RfEventType::None, logic.Update(0, false).type);
  TEST_ASSERT_EQUAL(rf::RfEventType::None, logic.Update(10, true).type);
  TEST_ASSERT_EQUAL(rf::RfEventType::None, logic.Update(35, true).type);
  TEST_ASSERT_EQUAL(rf::RfEventType::Triggered, logic.Update(60, true).type);
  TEST_ASSERT_EQUAL(rf::RfEventType::None, logic.Update(100, true).type);
  TEST_ASSERT_EQUAL(rf::RfEventType::None, logic.Update(130, false).type);
  logic.StartLearning(200);
  TEST_ASSERT_EQUAL(rf::RfEventType::None, logic.Update(500, false).type);
  TEST_ASSERT_EQUAL(rf::RfEventType::LearningTimeout, logic.Update(10201, false).type);
}

void test_state_transitions_and_bounds() {
  TEST_ASSERT_EQUAL(app::AppState::Boot,
                    app::ResolveState({100, false, false, false, false}));
  TEST_ASSERT_EQUAL(app::AppState::Provisioning,
                    app::ResolveState({5000, true, false, false, false}));
  TEST_ASSERT_EQUAL(app::AppState::RfLearning,
                    app::ResolveState({5000, false, true, false, false}));
  TEST_ASSERT_EQUAL(app::AppState::Ota,
                    app::ResolveState({5000, false, false, true, false}));
  TEST_ASSERT_EQUAL(app::AppState::Error,
                    app::ResolveState({5000, false, false, false, true}));
  TEST_ASSERT_EQUAL_UINT16(300, config::ClampRelayPulseMs(10));
  TEST_ASSERT_EQUAL_UINT16(300, config::ClampRelayPulseMs(6000));
  TEST_ASSERT_EQUAL_UINT16(10000, config::ClampRelayCooldownMs(12000));
}

void setup() {
  UNITY_BEGIN();
  RUN_TEST(test_button_timing);
  RUN_TEST(test_relay_pulse_and_cooldown);
  RUN_TEST(test_rf_trigger_and_learning);
  RUN_TEST(test_state_transitions_and_bounds);
  UNITY_END();
}

void loop() {}
