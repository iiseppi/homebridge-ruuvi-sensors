# Homebridge Ruuvi Sensors

[![npm version](https://badge.fury.io/js/homebridge-ruuvi-sensors.svg)](https://badge.fury.io/js/homebridge-ruuvi-sensors)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![npm downloads](https://img.shields.io/npm/dt/homebridge-ruuvi-sensors.svg)](https://www.npmjs.com/package/homebridge-ruuvi-sensors)

*(Scroll down for the Finnish version / Suomenkielinen ohje löytyy alempaa)*

A modern and highly optimized Homebridge Dynamic Platform plugin for [RuuviTag](https://ruuvi.com) sensors. 

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

### Option C: Shelly BLE Gateway (Ruuvi Gateway Simulator)

You can also use a compatible Shelly device as a lightweight, highly optimized BLE-to-Webhook bridge. 

The script below listens to nearby RuuviTag advertisements over Bluetooth and forwards them to Homebridge in the exact same JSON format as an official Ruuvi Gateway.

This is especially useful if:
- Your Homebridge server does not have Bluetooth.
- Your RuuviTags are far away from the Homebridge server.
- You already have a nearby Shelly Gen3 device installed.

#### Supported Shelly Devices
Works on Shelly devices that support custom scripting (mJS) and act as BLE observers.
Examples:
- Shelly Plus 1 / Shelly Plus Plug S
- Shelly Gen3 devices

#### Setup Instructions
1. Open your Shelly device web interface.
2. Go to **Settings -> Bluetooth** and ensure Bluetooth is enabled.
3. Go to **Scripts** and create a new script.
4. Paste the script below.
5. Change the `webhookUrl` to match your Homebridge server IP and plugin port.
6. Save, click **Start**, and toggle the **Enable** switch so the script runs automatically on boot.
7. Enable **Gateway Webhook** in the Homebridge plugin settings.

<details>
<summary><strong>Shelly Script Code (Click to expand)</strong></summary>

```javascript
// ====================================================================
// CONFIGURATION
// ====================================================================
const CONFIG = {
  // IMPORTANT: Replace with your Homebridge server's IP address and Webhook port.
  // NOTE: This is NOT your Homebridge UI port (e.g., 8581).
  // Format: "http://[YOUR_HOMEBRIDGE_IP]:[WEBHOOK_PORT]"
  webhookUrl: "http://192.168.1.100:7777", 
  
  // How often to send telemetry data to Homebridge (in milliseconds).
  sendIntervalMs: 10000 
};
// ====================================================================

let tagCache = {};

// Fast binary to hex conversion
function b2h(data) {
  let res = "";
  for (let i = 0; i < data.length; i++) {
    let hex = data.charCodeAt(i).toString(16);
    if (hex.length === 1) hex = "0" + hex;
    res += hex.toUpperCase();
  }
  return res;
}

// BLE Scanner callback
function scanCb(event, result) {
  if (event !== BLE.Scanner.SCAN_RESULT || !result.advData) return;

  let hexData = b2h(result.advData).toUpperCase();

  // Bulletproof search: Look for Ruuvi's manufacturer ID in the raw data
  if (hexData.indexOf("FF9904") !== -1 || hexData.indexOf("9904") !== -1) {
    let mac = result.addr.toUpperCase();
    tagCache[mac] = {
      "rssi": result.rssi,
      "data": hexData
    };
    print("-> Picked up RuuviTag: ", mac, " | RSSI: ", result.rssi);
  }
}

// Data sender function
function sendData() {
  let tagKeys = Object.keys(tagCache);
  if (tagKeys.length === 0) {
    print("10 seconds elapsed. Waiting for Ruuvi broadcasts...");
    return;
  }

  let payload = { "data": { "tags": tagCache } };
  print("Sending HTTP POST: " + tagKeys.length + " RuuviTag(s)...");

  Shelly.call(
    "HTTP.POST", 
    { url: CONFIG.webhookUrl, body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } }
  );
  tagCache = {};
}

// Start lightweight listening mode (0% CPU overhead)
BLE.Scanner.Subscribe(scanCb);
Timer.set(CONFIG.sendIntervalMs, true, sendData);
print("Ruuvi Gateway Simulator started!");
```
</details>

#### Notes
- This script uses a passive `Subscribe` method instead of starting a new scanner, completely eliminating Shelly CPU throttling issues.
- The script automatically filters and forwards all detected RuuviTags.
- Multiple Shelly devices can be used simultaneously for better coverage.

---

---

# Homebridge Ruuvi Sensors (Suomi)

Moderni ja optimoitu Homebridge-liitännäinen [RuuviTag](https://ruuvi.com)-antureille.

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

### Vaihtoehto C: Shelly BLE Gateway (Ruuvi Gateway -simulaattori)

Voit käyttää yhteensopivaa Shelly-laitetta kevyenä ja erittäin suorituskykyisenä Bluetooth–Webhook-siltana.  

Alla oleva skripti kuuntelee lähialueen RuuviTag-mainospaketteja Bluetoothin kautta ja välittää ne Homebridgeen täsmälleen samassa JSON-muodossa kuin aito Ruuvi Gateway.

Tämä on hyödyllinen erityisesti silloin kun:
- Homebridge-palvelimessa ei ole Bluetoothia.
- RuuviTagit ovat liian kaukana Homebridge-palvelimesta.
- Käytössäsi on jo lähellä oleva Shelly Gen3 -laite.

#### Tuetut Shelly-laitteet
Toimii Shelly-laitteilla, jotka tukevat skriptausta (mJS) ja BLE-skannausta.
Esimerkkejä:
- Shelly Plus Plug S / Shelly Plus 1
- Shelly Gen3 -laitteet

#### Käyttöönotto
1. Avaa Shelly-laitteen selainkäyttöliittymä.
2. Mene kohtaan **Settings -> Bluetooth** ja varmista, että Bluetooth on päällä.
3. Mene kohtaan **Scripts** ja luo uusi skripti.
4. Liitä alla oleva koodi.
5. Vaihda `webhookUrl` vastaamaan Homebridge-palvelimesi IP-osoitetta ja porttia.
6. Tallenna koodi, paina **Start** ja laita **Enable**-kytkin päälle, jotta skripti käynnistyy automaattisesti sähkökatkojen jälkeen.
7. Ota pluginin asetuksista käyttöön **Gateway Webhook**.

<details>
<summary><strong>Shelly Script -koodi (Klikkaa auki)</strong></summary>

```javascript
// ====================================================================
// ASETUKSET
// ====================================================================
const CONFIG = {
  // TÄRKEÄÄ: Vaihda tähän Homebridge-palvelimesi IP-osoite ja Webhook-portti.
  // HUOM: Tämä EI ole Homebridgen käyttöliittymän portti (esim. 8581).
  // Muoto: "http://[HOMEBRIDGE_IP]:[WEBHOOK_PORT]"
  webhookUrl: "http://192.168.1.100:7777", 
  
  // Kuinka usein data lähetetään Homebridgeen (millisekunteina). 10000 = 10 sekuntia.
  sendIntervalMs: 10000 
};
// ====================================================================

let tagCache = {};

// Nopea hex-käännös
function b2h(data) {
  let res = "";
  for (let i = 0; i < data.length; i++) {
    let hex = data.charCodeAt(i).toString(16);
    if (hex.length === 1) hex = "0" + hex;
    res += hex.toUpperCase();
  }
  return res;
}

// Skannerin kuuntelija
function scanCb(event, result) {
  if (event !== BLE.Scanner.SCAN_RESULT || !result.advData) return;

  let hexData = b2h(result.advData).toUpperCase();

  // Pomminvarma haku: Etsitään Ruuvin sormenjälki suoraan raakadatasta
  if (hexData.indexOf("FF9904") !== -1 || hexData.indexOf("9904") !== -1) {
    let mac = result.addr.toUpperCase();
    tagCache[mac] = {
      "rssi": result.rssi,
      "data": hexData
    };
    print("-> Poimittiin RuuviTag: ", mac, " | RSSI: ", result.rssi);
  }
}

// Lähetysfunktio
function sendData() {
  let tagKeys = Object.keys(tagCache);
  if (tagKeys.length === 0) {
    print("10 sekuntia kulunut. Odotetaan Ruuvien lähetyksiä...");
    return;
  }

  let payload = { "data": { "tags": tagCache } };
  print("Lähetetään HTTP POST: " + tagKeys.length + " RuuviTagia...");

  Shelly.call(
    "HTTP.POST", 
    { url: CONFIG.webhookUrl, body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } }
  );
  tagCache = {};
}

// Käynnistetään erittäin kevyt kuuntelutila (0% CPU-rasitus)
BLE.Scanner.Subscribe(scanCb);
Timer.set(CONFIG.sendIntervalMs, true, sendData);
print("Ruuvi Gateway -simulaattori käynnistetty!");
```
</details>

#### Huomioita
- Skripti käyttää passiivista `Subscribe`-metodia kokonaisen uuden skannerin käynnistämisen sijaan. Tämä poistaa Shellyn prosessorin ylikuumenemis- ja kaatumisongelmat täysin.
- Skripti välittää automaattisesti kaikki löytämänsä RuuviTagit.
- Voit käyttää useita Shelly-laitteita samanaikaisesti parantaaksesi Bluetooth-kattavuutta kotonasi.
```