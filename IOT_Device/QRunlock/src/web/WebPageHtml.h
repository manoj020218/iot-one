#pragma once

namespace web {

inline constexpr char kIndexHtml[] = R"HTML(
<!doctype html><html><head><meta name=viewport content="width=device-width,initial-scale=1">
<title>QRUnlock</title><style>
body{font:15px sans-serif;margin:20px;background:#f6f0e8;color:#1f1a16}button,input{margin:4px 0;padding:10px}
section{background:#fff;padding:14px;border-radius:12px;margin:12px 0;box-shadow:0 4px 18px rgba(0,0,0,.08)}
pre{white-space:pre-wrap;background:#111;color:#e7f7ee;padding:12px;border-radius:10px;overflow:auto}
</style></head><body>
<h1>QRUnlock RF PSU</h1>
<section><h3>Local API Auth</h3><input id=apiToken type=password placeholder="Local API token"><br>
<button onclick="saveToken()">Save Token In Browser</button> <small>Header: X-Jenix-Local-Token</small></section>
<section><button onclick="post('/api/relay/pulse',{})">Pulse Relay</button>
<button onclick="post('/api/rf/learn/start',{})">Start RF Learn</button>
<button onclick="post('/api/rf/learn/cancel',{})">Cancel RF Learn</button>
<button onclick="post('/api/provisioning',{})">Start Provisioning AP</button></section>
<section><h3>Wi-Fi</h3><input id=ssid placeholder="Wi-Fi SSID"><br><input id=pwd type=password placeholder="Wi-Fi Password"><br>
<button onclick="post('/api/wifi',{ssid:gid('ssid').value,password:gid('pwd').value})">Save Wi-Fi</button></section>
<section><h3>Settings</h3><input id=pulse type=number min=300 max=300 placeholder="Relay pulse ms"><br>
<input id=cooldown type=number min=0 max=10000 placeholder="Relay cooldown ms"><br>
<input id=otaUrl placeholder="OTA URL"><br>
<button onclick="post('/api/settings',{relayPulseMs:num('pulse'),relayCooldownMs:num('cooldown'),otaUrl:gid('otaUrl').value})">Save Settings</button></section>
<section><h3>OTA</h3><input id=otaVersion placeholder="Target version"><br>
<button onclick="post('/api/ota/install',{url:gid('otaUrl').value,targetVersion:gid('otaVersion').value,allowDowngrade:false})">Install OTA</button></section>
<section><button onclick="post('/api/restart',{})">Restart</button>
<button onclick="post('/api/factory-reset',{})">Factory Reset</button></section>
<section><h3>Status</h3><pre id=status>loading...</pre></section>
<script>
const gid=id=>document.getElementById(id),num=id=>parseInt(gid(id).value||'0',10);
const authHeader='X-Jenix-Local-Token';
function authHeaders(){const token=gid('apiToken').value.trim();const headers={'Content-Type':'application/json'};if(token)headers[authHeader]=token;return headers;}
function saveToken(){localStorage.setItem('qruLocalApiToken',gid('apiToken').value);}
async function post(url,body){const r=await fetch(url,{method:'POST',headers:authHeaders(),body:JSON.stringify(body)});load();return r.text();}
async function load(){const r=await fetch('/api/status');const d=await r.json();gid('status').textContent=JSON.stringify(d,null,2);
if(d.relay){gid('pulse').value=d.relay.pulseMs;gid('cooldown').value=d.relay.cooldownMs}
if(d.ota&&d.ota.url){gid('otaUrl').value=d.ota.url}}
gid('apiToken').value=localStorage.getItem('qruLocalApiToken')||'';
load();setInterval(load,2000);
</script></body></html>
)HTML";

}  // namespace web
