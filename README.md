# Homebridge Ruuvi Sensors

[![npm version](https://badge.fury.io/js/homebridge-ruuvi-sensors.svg)](https://badge.fury.io/js/homebridge-ruuvi-sensors)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![npm downloads](https://img.shields.io/npm/dt/homebridge-ruuvi-sensors.svg)](https://www.npmjs.com/package/homebridge-ruuvi-sensors)

*(Scroll down for the Finnish version / Suomenkielinen ohje löytyy alempaa)*

A moder and highly optimized Homebridge Dynamic Platform plugin for [RuuviTag](https://ruuvi.com) sensors. 

This plugin brings your Ruuvi environment sensors into Apple HomeKit, providing real-time temperature, humidity, and battery level data, alongside beautiful historical graphs in the Eve app.

## Features
* **Two Data Sources:** Receive data locally via **Bluetooth (BLE)** or over the network using **Ruuvi Gateway Webhooks**. You can even use both simultaneously!
* **All Formats Supported:** Automatically parses Format 3 (RAWv1), Format 5 (RAWv2), Format 0xE1 (Extended Long Range), and **Encrypted Format 8** (Requires your device-specific decryption key).
* **Eve App History:** Integrated `fakegato-history` to log and display historical temperature and humidity data.
* **Dynamic Platform:** Adds and removes sensors seamlessly through the Homebridge UI without requiring manual config file edits.

## Prerequisites
* **Node.js:** version `>=22.0.0` or newer.
* **Homebridge:** version `^1.8.0` or `^2.0.0`.
* *(If using Bluetooth on Linux/Raspberry Pi)*: You must install Bluetooth dependencies for the `@abandonware/noble` library:
  ```bash
  sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
  ```

## Installation
The easiest way to install and configure this plugin is via [Homebridge Config UI X](https://github.com/oznu/homebridge-config-ui-x).
1. Search for `homebridge-ruuvi-sensors` in the Homebridge UI Plugins tab and click **Install**.
2. Configure your sensors and data sources via the visual settings menu.

**CLI Installation:**
```bash
npm install -g homebridge-ruuvi-sensors
```

## Configuration Guide

### Option A: Local Bluetooth Scanning
Enable the **Bluetooth** option in the plugin settings. The plugin will use your Homebridge server's Bluetooth adapter to scan for nearby RuuviTags. 
* *Note for Mac users:* macOS hides BLE MAC addresses by default, but this plugin contains a custom workaround to extract the true MAC address directly from the Ruuvi broadcast payload.

### Option B: Ruuvi Gateway Webhook
1. Enable the **Gateway Webhook** option in the plugin settings and define a port (default: `8080`).
2. Open your Ruuvi Gateway local IP in your browser.
3. Go to **Settings -> Custom Server**.
4. Set the URL to `http://<YOUR_HOMEBRIDGE_IP>:<PORT>` (e.g., `http://192.168.1.100:8080`).
5. Ensure the data format is set to JSON.

### Option C: Shelly BLE Gateway (Not tested yet!) 

You can also use a compatible Shelly-device as a lightweight BLE-to-Webhook bridge.  

The script below scans nearby RuuviTags over Bluetooth and forwards the advertisements to Homebridge in the exact same JSON format as a real Ruuvi Gateway.

This is especially useful if:

- Your Homebridge server does not have Bluetooth.

- Your RuuviTags are far away from the Homebridge server.

- You already have a nearby Shelly Gen2/Gen3 device installed.

### Supported Shelly Devices

Works on Shelly devices that support:

- Bluetooth scanning

- Custom scripting (Shelly Script)

Examples:

- Shelly Plus Plug S

- Shelly Plus 1

- Shelly Gen3 devices

### Setup Instructions

1. Open your Shelly device web interface.

2. Go to **Scripts**.

3. Create a new script.

4. Paste the script below.

5. Change the `webhookUrl` to match your Homebridge server IP and plugin port.

6. Save and start the script.

7. Enable **Gateway Webhook** in the Homebridge plugin settings.

The Shelly device will now behave like a miniature Ruuvi Gateway and forward BLE packets automatically.

<details>

<summary><strong>Shelly Script Example</strong></summary>

```javascript

// --- SETTINGS ---
const CONFIG = {
  webhookUrl: "http://192.168.1.2:8080", // VAIHDA TÄHÄN HOMEBRIDGE IP JA PORTTI
  sendIntervalMs: 10000 // Authentic Ruuvi Gateway send interval (10 seconds)
};
// -----------------

let tagCache = {};

// Helper function: Converts binary data to hex string
function b2h(data) {
  let res = "";
  for (let i = 0; i < data.length; i++) {
    let hex = data.charCodeAt(i).toString(16);
    if (hex.length === 1) hex = "0" + hex;
    res += hex.toUpperCase();
  }
  return res;
}

// Bluetooth scanner callback listening to all BLE traffic
function scanCb(event, result) {
  // Use official API constants: BLE.Scanner.SCAN_RESULT
  if (event !== BLE.Scanner.SCAN_RESULT) return;
  if (!result || !result.addr || !result.advData) return;

  // Ruuvi manufacturer ID in decimal (0x0499 = 1177)
  let mfgData = result.manufacturer_data;
  if (mfgData && mfgData["1177"]) {
    let mac = result.addr.toUpperCase();
    let rssi = result.rssi;
    let hexData = b2h(result.advData);

    // Update the latest data in the cache
    tagCache[mac] = {
      "rssi": rssi,
      "data": hexData
    };
  }
}

// Function to send data to Homebridge and clear the cache
function sendData() {
  let tagKeys = Object.keys(tagCache);
  if (tagKeys.length === 0) return;

  // Create a JSON payload exactly like the authentic Ruuvi Gateway
  let payload = {
    "data": {
      "tags": tagCache
    }
  };

  print("Sending HTTP POST: " + tagKeys.length + " Ruuvi(s) to Homebridge...");

  Shelly.call(
    "HTTP.POST", 
    {
      url: CONFIG.webhookUrl,
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" }
    },
    function (result, error_code, error_message) {
      if (error_code !== 0) {
        print("Error! Homebridge not responding: " + error_message);
      }
    }
  );

  // Clear the cache after sending
  tagCache = {};
}

// Start or hook into the BLE Scanner using proper Gen3 API
if (BLE.Scanner.isRunning()) {
  print("BLE Scanner is already running by another script. Subscribing to events...");
} else {
  print("Starting a new BLE Scanner...");
  BLE.Scanner.start({
    duration_ms: BLE.Scanner.INFINITE_SCAN,
    active: false // Passive scanning is battery-friendly for RuuviTags
  });
}

// Subscribe our callback to the Scanner
BLE.Scanner.subscribe(scanCb);

// Start the upload timer
Timer.set(CONFIG.sendIntervalMs, true, sendData);
print("Ruuvi Gateway Simulator started successfully!");

```

</details>

### Notes

- Passive BLE scanning is used to minimize CPU and power usage.

- The script forwards all detected RuuviTags automatically.

- Multiple Shelly devices can be used simultaneously for better coverage.

- The plugin treats Shelly-forwarded packets exactly like native Ruuvi Gateway packets.

---

---

# Homebridge Ruuvi Sensors (Suomi)

Moderni Homebridge-liitännäinen [RuuviTag](https://ruuvi.com)-antureille.

Tämä liitännäinen tuo Ruuvin ympäristöanturit Apple Koti -sovellukseen (HomeKit). Se näyttää reaaliaikaisen lämpötilan, ilmankosteuden ja pariston tason, minkä lisäksi se piirtää historiagraafeja Eve-sovelluksessa.

## Ominaisuudet
* **Kaksi tiedonkeruutapaa:** Vastaanota dataa paikallisesti **Bluetoothin (BLE)** kautta tai verkon yli **Ruuvi Gatewayn Webhookilla**. Voit käyttää myös molempia yhtaikaa!
* **Tuki kaikille dataformaateille:** Tunnistaa automaattisesti formaatit 3 (RAWv1), 5 (RAWv2), 0xE1 (Extended) sekä **salatun formaatti 8:n** (vaatii laitekohtaisen purkuavaimen).
* **Eve-historia:** Sisäänrakennettu `fakegato-history` tallentaa lämpötila- ja kosteushistorian Eve-älykotisovellusta varten.
* **Dynaaminen alusta:** Antureiden lisääminen ja poistaminen onnistuu helposti Homebridgen käyttöliittymästä ilman manuaalista konfiguraatiotiedostojen muokkausta.

## Vaatimukset
* **Node.js:** versio `>=22.0.0` tai uudempi.
* **Homebridge:** versio `^1.8.0` tai `^2.0.0`.
* *(Jos käytät Bluetoothia Linuxilla/Raspberry Pi:llä)*: Asenna Bluetooth-ajurit terminaalissa:
  ```bash
  sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
  ```

## Asennus
Helpoin tapa asentaa on käyttää Homebridgen graafista käyttöliittymää (Config UI X).
1. Hae Liitännäiset-välilehdeltä `homebridge-ruuvi-sensors` ja paina **Asenna**.
2. Syötä anturiesi MAC-osoitteet ja nimet visuaalisen asetusvalikon kautta.

**Asennus komentoriviltä:**
```bash
npm install -g homebridge-ruuvi-sensors
```

## Käyttöönotto

### Vaihtoehto A: Paikallinen Bluetooth-skannaus
Kytke asetuksista **Bluetooth** päälle. Plugin alkaa automaattisesti kuunnella Homebridge-palvelimesi lähistöllä olevia antureita.
* *Huom. Mac-käyttäjille:* macOS piilottaa muiden laitteiden MAC-osoitteet tietoturvasyistä, mutta tämä plugin osaa poimia oikean MAC-osoitteen suoraan Ruuvin lähettämän datapaketin sisältä.

### Vaihtoehto B: Ruuvi Gateway Webhook
1. Kytke asetuksista **Gateway Webhook** päälle ja määritä portti (oletus: `8080`).
2. Mene selaimella Ruuvi Gateway -reitittimesi asetuksiin (laitteen paikallinen IP-osoite).
3. Avaa **Settings -> Custom Server**.
4. Syötä osoitteeksi `http://<HOMEBRIDGE_PALVELIMEN_IP>:<PORT>` (esim. `http://192.168.1.100:8080`).
5. Varmista, että tiedostomuotona on JSON.

### Vaihtoehto C: Shelly BLE Gateway (Tätä ei ole vielä testattu!)

Voit käyttää yhteensopivaa Shelly-laitetta kevyenä Bluetooth–Webhook-siltana.  

Alla oleva skripti kuuntelee lähialueen RuuviTag-mainospaketteja Bluetoothin kautta ja välittää ne Homebridgeen täsmälleen samassa JSON-muodossa kuin oikea Ruuvi Gateway.

Tämä on hyödyllinen erityisesti silloin kun:

- Homebridge-palvelimessa ei ole Bluetoothia.

- RuuviTagit ovat liian kaukana Homebridge-palvelimesta.

- Käytössäsi on jo lähellä oleva Shelly Gen2/Gen3 -laite.

### Tuetut Shelly-laitteet

Toimii Shelly-laitteilla, jotka tukevat:

- Bluetooth-skannausta

- Shelly Script -skriptauksia

Esimerkkejä:

- Shelly Plus Plug S

- Shelly Plus 1

- Shelly Gen3 -laitteet

### Käyttöönotto

1. Avaa Shelly-laitteen selainkäyttöliittymä.

2. Mene kohtaan **Scripts**.

3. Luo uusi skripti.

4. Liitä alla oleva koodi.

5. Vaihda `webhookUrl` vastaamaan Homebridge-palvelimesi IP-osoitetta ja porttia.

6. Tallenna ja käynnistä skripti.

7. Ota pluginin asetuksista käyttöön **Gateway Webhook**.

Shelly-laite toimii tämän jälkeen pienenä Ruuvi Gatewayna ja välittää BLE-mainospaketit automaattisesti Homebridgeen.

<details>

<summary><strong> Shelly Script -esimerkki</strong></summary>

```javascript

// --- ASETUKSET ---
const CONFIG = {
  webhookUrl: "http://192.168.1.2:8080", // VAIHDA TÄHÄN HOMEBRIDGESI IP-OSOITE JA PORTTI
  sendIntervalMs: 10000 // Virallisen Ruuvi Gatewayn lähetysväli (10 sekuntia)
};
// -----------------

let tagCache = {};

// Apufunktio: Muuttaa binääridatan hex-muotoon (merkkijonoksi)
function b2h(data) {
  let res = "";
  for (let i = 0; i < data.length; i++) {
    let hex = data.charCodeAt(i).toString(16);
    if (hex.length === 1) hex = "0" + hex;
    res += hex.toUpperCase();
  }
  return res;
}

// Bluetooth-skannerin takaisinkutsu, joka kuuntelee kaikkea BLE-liikennettä
function scanCb(event, result) {
  // Käytetään virallisia API-vakioita: BLE.Scanner.SCAN_RESULT
  if (event !== BLE.Scanner.SCAN_RESULT) return;
  if (!result || !result.addr || !result.advData) return;

  // Ruuvin valmistajatunnus kymmenjärjestelmässä (0x0499 = 1177)
  let mfgData = result.manufacturer_data;
  if (mfgData && mfgData["1177"]) {
    let mac = result.addr.toUpperCase();
    let rssi = result.rssi;
    let hexData = b2h(result.advData);

    // Päivitetään RuuviTagin uusin data välimuistiin
    tagCache[mac] = {
      "rssi": rssi,
      "data": hexData
    };
  }
}

// Funktio, joka lähettää välimuistissa olevat tiedot Homebridgeen ja tyhjentää välimuistin
function sendData() {
  let tagKeys = Object.keys(tagCache);
  if (tagKeys.length === 0) return;

  // Luodaan JSON-paketti, joka vastaa täysin aitoa Ruuvi Gatewayta
  let payload = {
    "data": {
      "tags": tagCache
    }
  };

  print("Lähetetään HTTP POST: " + tagKeys.length + " RuuviTagin tiedot Homebridgeen...");

  Shelly.call(
    "HTTP.POST", 
    {
      url: CONFIG.webhookUrl,
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" }
    },
    function (result, error_code, error_message) {
      if (error_code !== 0) {
        print("Virhe! Homebridge ei vastaa: " + error_message);
      }
    }
  );

  // Tyhjennetään välimuisti lähetyksen jälkeen
  tagCache = {};
}

// Käynnistetään Bluetooth-skanneri tai hyödynnetään jo käynnissä olevaa (Gen3 API)
if (BLE.Scanner.isRunning()) {
  print("Bluetooth-skanneri pyörii jo taustalla (toisen skriptin käynnistämänä). Liitytään mukaan...");
} else {
  print("Käynnistetään uusi Bluetooth-skanneri...");
  BLE.Scanner.start({
    duration_ms: BLE.Scanner.INFINITE_SCAN,
    active: false // Passiivinen skannaus säästää RuuviTagien paristoja
  });
}

// Tilataan skannerin tuottamat BLE-tapahtumat omaan funktioomme
BLE.Scanner.subscribe(scanCb);

// Käynnistetään ajastin datan säännöllistä lähetystä varten
Timer.set(CONFIG.sendIntervalMs, true, sendData);
print("Ruuvi Gateway -simulaattori käynnistetty onnistuneesti!");

```

</details>

### Huomioita

- Skripti käyttää passiivista BLE-skannausta resurssien säästämiseksi.

- Kaikki löydetyt RuuviTagit välitetään automaattisesti Homebridgeen.

- Useita Shelly-laitteita voi käyttää samanaikaisesti kattavuuden parantamiseksi.

- Plugin käsittelee Shellyn välittämät paketit täysin samalla tavalla kuin aidon Ruuvi Gatewayn lähettämät paketit.
