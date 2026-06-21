// ====================================================================
// CONFIGURATION
// ====================================================================
const CONFIG = {
  // IMPORTANT: Replace with your Homebridge server's IP address and Webhook port.
  // NOTE: This is NOT your Homebridge UI port (e.g., 8581). 
  // It is the specific "Webhook Port" you set in this plugin's settings.
  // Format: "http://[YOUR_HOMEBRIDGE_IP]:[WEBHOOK_PORT]"
  // Example: "http://192.168.1.100:7777"
  webhookUrl: 'http://[YOUR_HOMEBRIDGE_IP]:[WEBHOOK_PORT]', 
  
  // How often to send data to Homebridge (in milliseconds). 10000 = 10 seconds.
  sendIntervalMs: 10000, 
};
// ====================================================================

let tagCache = {};

// Fast binary to hex conversion
function b2h(data) {
  let res = '';
  for (let i = 0; i < data.length; i++) {
    let hex = data.charCodeAt(i).toString(16);
    if (hex.length === 1) {
      hex = '0' + hex;
    }
    res += hex.toUpperCase();
  }
  return res;
}

// BLE Scanner callback
function scanCb(event, result) {
  if (event !== BLE.Scanner.SCAN_RESULT || !result.advData) {
    return;
  }

  let hexData = b2h(result.advData).toUpperCase();

  // Bulletproof search: Look for Ruuvi's manufacturer ID in the raw data
  if (hexData.indexOf('FF9904') !== -1 || hexData.indexOf('9904') !== -1) {
    let mac = result.addr.toUpperCase();
    tagCache[mac] = {
      'rssi': result.rssi,
      'data': hexData,
    };
    print('-> Picked up RuuviTag: ', mac, ' | RSSI: ', result.rssi);
  }
}

// Data sender function
function sendData() {
  let tagKeys = Object.keys(tagCache);
  if (tagKeys.length === 0) {
    print('10 seconds elapsed. Waiting for Ruuvi broadcasts...');
    return;
  }

  let payload = { 'data': { 'tags': tagCache } };
  print('Sending HTTP POST: ' + tagKeys.length + ' RuuviTag(s)...');

  Shelly.call(
    'HTTP.POST', 
    { url: CONFIG.webhookUrl, body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } },
  );
  tagCache = {};
}

// Start lightweight listening mode
BLE.Scanner.Subscribe(scanCb);
Timer.set(CONFIG.sendIntervalMs, true, sendData);
print('Ruuvi Gateway Simulator started!');