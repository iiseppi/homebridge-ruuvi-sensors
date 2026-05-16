import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import * as http from 'http';
import { RuuviPlatformAccessory } from './platformAccessory.js';

// Tuodaan Bluetooth-kirjasto oikeaoppisesti ES-moduulina
import noble from '@abandonware/noble';

export class RuuviSensorsPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;
  public readonly accessories: Map<string, PlatformAccessory> = new Map();
  private readonly accessoryHandlers: Map<string, RuuviPlatformAccessory> = new Map();

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      // 1. Käynnistetään Webhook-palvelin jos se on päällä asetuksissa
      if (this.config.gateway && this.config.gateway.enabled) {
        this.setupWebhookServer();
      }

      // 2. Käynnistetään Bluetooth-skannaus jos se on päällä asetuksissa
      if (this.config.bluetooth && this.config.bluetooth.enabled) {
        this.setupBluetooth();
      }
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.set(accessory.context.device.mac.toUpperCase(), accessory);
  }

  // --- BLUETOOTH-LOGIIKKA ---
  setupBluetooth() {
    this.log.info('Initializing local Bluetooth scanning...');

    // noble vaatii stateChange-tapahtuman kuuntelun ennen kuin skannaus voidaan aloittaa
    noble.on('stateChange', (state: string) => {
      if (state === 'poweredOn') {
        this.log.info('Bluetooth hardware is ready. Starting to scan for RuuviTags...');
        // true sallii duplikaatit, jotta saamme jatkuvaa reaaliaikaista dataa antureilta
        noble.startScanning([], true);
      } else {
        this.log.warn(`Bluetooth state changed to: ${state}. Scanning stopped.`);
        noble.stopScanning();
      }
    });

    noble.on('discover', (peripheral: any) => {
      const mfgData = peripheral.advertisement?.manufacturerData;
      
      // Tarkistetaan onko kyseessä RuuviTag (valmistajatunnus 0x0499)
      if (mfgData && mfgData.length >= 2) {
        const companyId = mfgData.readUInt16LE(0);
        if (companyId === 0x0499) {
          const rawHexData = mfgData.toString('hex');
          
          // Haetaan laitteen MAC-osoite ja siistitään se muotoon AA:BB:CC:DD:EE:FF
          const mac = peripheral.address ? peripheral.address.toUpperCase() : '';
          
          if (mac) {
            this.log.debug(`[Bluetooth] Discovered Ruuvi data from ${mac}`);
            this.processRuuviData(mac, rawHexData);
          }
        }
      }
    });
  }

  // --- WEBHOOK-LOGIIKKA ---
  setupWebhookServer() {
    const port = this.config.gateway.port || 8080;

    const server = http.createServer((req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
          try {
            const payload = JSON.parse(body);
            if (payload.data && payload.data.tags) {
              for (const [mac, tagData] of Object.entries(payload.data.tags)) {
                const rawHexData = (tagData as any).data;
                this.processRuuviData(mac.toUpperCase(), rawHexData);
              }
            }
            res.writeHead(200); res.end('OK');
          } catch (error) {
            res.writeHead(400); res.end('Bad Request');
          }
        });
      } else {
        res.writeHead(404); res.end('Not Found');
      }
    });

    server.listen(port, () => {
      this.log.info(`Ruuvi Gateway Webhook server listening on port ${port}`);
    });
  }

  // --- YHTEINEN DATAN KÄSITTELY ---
  processRuuviData(mac: string, rawHexData: string) {
    const formattedMac = mac.toUpperCase();
    const configuredTags = this.config.tags || [];
    const deviceConfig = configuredTags.find((t: any) => t.mac.toUpperCase() === formattedMac);

    // Jos tagia ei ole lisätty Homebridgen asetuksissa, ohitetaan se
    if (!deviceConfig) {
      return;
    }

    let accessory = this.accessories.get(formattedMac);

    if (!accessory) {
      this.log.info('Discovering new RuuviTag via data stream:', deviceConfig.name);
      const uuid = this.api.hap.uuid.generate(formattedMac);
      accessory = new this.api.platformAccessory(deviceConfig.name, uuid);
      
      accessory.context.device = deviceConfig;
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.accessories.set(formattedMac, accessory);
    } else {
      accessory.context.device = deviceConfig;
    }

    let handler = this.accessoryHandlers.get(formattedMac);
    if (!handler) {
      handler = new RuuviPlatformAccessory(this, accessory);
      this.accessoryHandlers.set(formattedMac, handler);
    }
    handler.updateData(rawHexData);
  }
}