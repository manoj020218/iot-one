#pragma once

#include <Arduino.h>

namespace identity {

class DeviceIdentity {
 public:
  void Begin();

  const String& DeviceId() const { return deviceId_; }
  const String& BleName() const { return bleName_; }
  const String& ApSsid() const { return apSsid_; }
  const String& MdnsHost() const { return mdnsHost_; }
  const String& MacSuffix() const { return macSuffix_; }
  const String& HardwareId() const { return hardwareId_; }

 private:
  String macSuffix_;
  String hardwareId_;
  String deviceId_;
  String bleName_;
  String apSsid_;
  String mdnsHost_;
};

}  // namespace identity
