#include <unity.h>

#include "app/AppState.h"
#include "button/ButtonLogic.h"
#include "config/Defaults.h"
#include "relay/RelayLogic.h"
#include "rf/RfLogic.h"

void run_button_click(button::ButtonLogic& logic, uint32_t startedAtMs) {
  TEST_ASSERT_EQUAL(button::ButtonEvent::None, logic.Update(startedAtMs, true));
  TEST_ASSERT_EQUAL(button::ButtonEvent::None, logic.Update(startedAtMs + 30, true));
  TEST_ASSERT_EQUAL(button::ButtonEvent::None, logic.Update(startedAtMs + 60, false));
  TEST_ASSERT_EQUAL(button::ButtonEvent::None, logic.Update(startedAtMs + 90, false));
}

void test_button_timing() {
  button::ButtonLogic logic;
  TEST_ASSERT_EQUAL(button::ButtonEvent::None, logic.Update(0, false));
  run_button_click(logic, 10);
  TEST_ASSERT_EQUAL(button::ButtonEvent::ShortPress, logic.Update(800, false));

  button::ButtonLogic learnLogic;
  for (uint32_t i = 0; i < 5; ++i) run_button_click(learnLogic, 1000 + i * 150);
  TEST_ASSERT_EQUAL(button::ButtonEvent::RfLearnMultiPress, learnLogic.Update(2390, false));

  button::ButtonLogic resetLogic;
  for (uint32_t i = 0; i < 10; ++i) run_button_click(resetLogic, 3000 + i * 140);
  TEST_ASSERT_EQUAL(button::ButtonEvent::FactoryResetMultiPress,
                    resetLogic.Update(5050, false));

  button::ButtonLogic holdLogic;
  TEST_ASSERT_EQUAL(button::ButtonEvent::None, holdLogic.Update(6000, true));
  TEST_ASSERT_EQUAL(button::ButtonEvent::None, holdLogic.Update(6030, true));
  TEST_ASSERT_EQUAL(button::ButtonEvent::FactoryResetHold, holdLogic.Update(36030, true));
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
                    app::ResolveState({100, false, false, false, false, false, false, false}));
  TEST_ASSERT_EQUAL(app::AppState::ProvisioningAp,
                    app::ResolveState({5000, true, false, false, false, false, false, false}));
  TEST_ASSERT_EQUAL(app::AppState::ProvisioningBle,
                    app::ResolveState({5000, true, true, false, false, false, false, false}));
  TEST_ASSERT_EQUAL(app::AppState::WifiConnected,
                    app::ResolveState({5000, false, false, true, false, false, false, false}));
  TEST_ASSERT_EQUAL(app::AppState::CloudConnected,
                    app::ResolveState({5000, false, false, true, true, false, false, false}));
  TEST_ASSERT_EQUAL(app::AppState::RfLearning,
                    app::ResolveState({5000, false, false, false, false, true, false, false}));
  TEST_ASSERT_EQUAL(app::AppState::Ota,
                    app::ResolveState({5000, false, false, false, false, false, true, false}));
  TEST_ASSERT_EQUAL(app::AppState::Error,
                    app::ResolveState({5000, false, false, false, false, false, false, true}));
  TEST_ASSERT_EQUAL(app::AppState::Normal,
                    app::ResolveState({5000, false, false, false, false, false, false, false}));
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
