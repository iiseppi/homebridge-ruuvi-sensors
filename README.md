# Homebridge Ruuvi Sensors

[![npm version](https://badge.fury.io/js/homebridge-ruuvi-sensors.svg)](https://badge.fury.io/js/homebridge-ruuvi-sensors)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

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
