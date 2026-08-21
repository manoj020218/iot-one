#include <unity.h>

#include <cstring>

#include "app/AppState.h"
#include "button/ButtonLogic.h"
#include "cloud/CloudBridgeLogic.h"
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

void test_cloud_bridge_topic_building() {
  char topic[160];
  const int written =
      cloud::BuildTopic(topic, sizeof(topic), "home-abc123", "JNX-QRU-C3-001",
                        "JNX-QRU-C3-A7F2", "cmd");
  TEST_ASSERT_GREATER_THAN(0, written);
  TEST_ASSERT_EQUAL_STRING("jnx/home-abc123/JNX-QRU-C3-001/JNX-QRU-C3-A7F2/cmd", topic);

  char ackTopic[160];
  cloud::BuildTopic(ackTopic, sizeof(ackTopic), "home-abc123", "JNX-QRU-C3-001",
                    "JNX-QRU-C3-A7F2", "cmd/ack");
  TEST_ASSERT_EQUAL_STRING("jnx/home-abc123/JNX-QRU-C3-001/JNX-QRU-C3-A7F2/cmd/ack", ackTopic);
}

void test_cloud_bridge_command_parsing() {
  TEST_ASSERT_EQUAL(cloud::CommandKind::Unlock, cloud::ParseCommandKind("unlock"));
  TEST_ASSERT_EQUAL(cloud::CommandKind::Unknown, cloud::ParseCommandKind("set_relay"));
  TEST_ASSERT_EQUAL(cloud::CommandKind::Unknown, cloud::ParseCommandKind(""));
  TEST_ASSERT_EQUAL(cloud::CommandKind::Unknown, cloud::ParseCommandKind(nullptr));
}

void test_cloud_mqtt_auth_resolution() {
  config::CloudConfig cloudConfig = config::DefaultCloudConfig();
  config::MqttDeviceCredentialConfig deviceCredential =
      config::DefaultMqttDeviceCredentialConfig();

  TEST_ASSERT_EQUAL(config::CloudMqttAuthSource::None,
                    config::ResolveCloudMqttAuthSource(cloudConfig, deviceCredential));
  TEST_ASSERT_EQUAL_STRING("",
                           config::ResolveCloudMqttUsername(cloudConfig, deviceCredential));

  std::strncpy(cloudConfig.mqttUsername, "jenix_platform",
               sizeof(cloudConfig.mqttUsername) - 1);
  std::strncpy(cloudConfig.mqttPassword, "legacy",
               sizeof(cloudConfig.mqttPassword) - 1);
  TEST_ASSERT_EQUAL(config::CloudMqttAuthSource::LegacyCloudConfig,
                    config::ResolveCloudMqttAuthSource(cloudConfig, deviceCredential));
  TEST_ASSERT_EQUAL_STRING("jenix_platform",
                           config::ResolveCloudMqttUsername(cloudConfig, deviceCredential));
  TEST_ASSERT_EQUAL_STRING("legacy",
                           config::ResolveCloudMqttPassword(cloudConfig, deviceCredential));

  std::strncpy(deviceCredential.username, "device-123",
               sizeof(deviceCredential.username) - 1);
  std::strncpy(deviceCredential.password, "secret",
               sizeof(deviceCredential.password) - 1);
  deviceCredential.useForCloudBroker = 0;
  TEST_ASSERT_EQUAL(config::CloudMqttAuthSource::LegacyCloudConfig,
                    config::ResolveCloudMqttAuthSource(cloudConfig, deviceCredential));

  deviceCredential.useForCloudBroker = 1;
  TEST_ASSERT_EQUAL(config::CloudMqttAuthSource::DeviceCredential,
                    config::ResolveCloudMqttAuthSource(cloudConfig, deviceCredential));
  TEST_ASSERT_EQUAL_STRING("device-123",
                           config::ResolveCloudMqttUsername(cloudConfig, deviceCredential));
  TEST_ASSERT_EQUAL_STRING("secret",
                           config::ResolveCloudMqttPassword(cloudConfig, deviceCredential));
}

void run_all_tests() {
  UNITY_BEGIN();
  RUN_TEST(test_button_timing);
  RUN_TEST(test_relay_pulse_and_cooldown);
  RUN_TEST(test_rf_trigger_and_learning);
  RUN_TEST(test_state_transitions_and_bounds);
  RUN_TEST(test_cloud_bridge_topic_building);
  RUN_TEST(test_cloud_bridge_command_parsing);
  RUN_TEST(test_cloud_mqtt_auth_resolution);
  UNITY_END();
}

#if defined(ARDUINO)
void setup() {
  run_all_tests();
}

void loop() {}
#else
void setUp() {}

void tearDown() {}

int main() {
  run_all_tests();
  return 0;
}
#endif
