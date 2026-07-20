export function OrbitVisual() {
  return (
    <div className="orbit-shell" aria-hidden="true">
      <div className="orbit-panel orbit-panel-main">
        <span className="orbit-badge">Cloud Control</span>
        <strong>Device fleets, scenes, OTA and partner APIs</strong>
        <p>One modular platform for Jenix devices and approved third-party hardware.</p>
      </div>
      <div className="orbit-node orbit-node-app">PWA + Android</div>
      <div className="orbit-node orbit-node-api">MQTT / REST</div>
      <div className="orbit-node orbit-node-oem">OEM Branding</div>
      <div className="orbit-node orbit-node-edge">Gateways / Sensors</div>
      <div className="orbit-ring orbit-ring-outer" />
      <div className="orbit-ring orbit-ring-inner" />
    </div>
  );
}
