#pragma once

// AsyncTCP 3.3.2 includes <NetworkInterface.h> on ESP-IDF 5+, but the
// private Arduino core copy used by the Token Dispenser prov2 pilot does not
// ship that header. AsyncTCP never references any declaration from it here;
// the include is only a compatibility hook for newer Arduino cores. Provide
// a no-op project-local shim so mixed arduino+espidf builds can proceed
// without mutating downloaded library sources.
