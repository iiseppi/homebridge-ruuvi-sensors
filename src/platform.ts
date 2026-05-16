import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import * as http from 'http';
import { RuuviPlatformAccessory } from './platformAccessory.js';
import * as noble from '@abandonware/noble';

interface RuuviTagConfig {
  name: string;
  mac: string;
  dataFormat8Key?: string;
}

interface NoblePeripheral {
  address: string;
  advertisement?: {
    manufacturerData?: Buffer;
  };
}

interface GatewayTagData {
  data: string;
}

interface GatewayPayload {
  data?: {
    tags?: Record<string, GatewayTagData>;
  };
}

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
      this.cleanupOrphanedAccessories();

      if (this.config.gateway && this.config.gateway.enabled) {
        this.setupWebhookServer();
      }

      if (this.config.bluetooth && this.config.bluetooth.enabled) {
        this.setupBluetooth();
      }
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    const mac = accessory.context.device?.mac?.toUpperCase();
    if (mac) {
      this.accessories.set(mac, accessory);
    } else {
      const placeholderMac = 'UNKNOWN_' + Math.random().toString(36).substring(2, 9).toUpperCase();
      this.accessories.set(placeholderMac, accessory);
    }
  }

  cleanupOrphanedAccessories() {
    const configuredTags = (this.config.tags || []) as RuuviTagConfig[];
    const configuredMacs = configuredTags.map((t) => t.mac.toUpperCase());

    for (const [mac, accessory] of this.accessories.entries()) {
      if (mac.startsWith('UNKNOWN_') || !configuredMacs.includes(mac)) {
        this.log.info('Removing orphaned or unconfigured accessory from HomeKit:', accessory.displayName);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessories.delete(mac);
      }
    }
  }

  setupBluetooth() {
    this.log.info('Initializing local Bluetooth scanning...');

    noble.default.on('stateChange', (state: string) => {
      if (state === 'poweredOn') {
        this.log.info('Bluetooth hardware is ready. Starting to scan for RuuviTags...');
        noble.default.startScanning([], true);
      } else {
        this.log.warn(`Bluetooth state changed to: ${state}. Scanning stopped.`);
        noble.default.stopScanning();
      }
    });

    noble.default.on('discover', (peripheral: NoblePeripheral) => {
      const mfgData = peripheral.advertisement?.manufacturerData;
      
      if (mfgData && mfgData.length >= 2) {
        const companyId = mfgData.readUInt16LE(0);
        if (companyId === 0x0499) {
          const rawHexData = mfgData.toString('hex');
          const mac = peripheral.address ? peripheral.address.toUpperCase() : '';
          
          if (mac) {
            this.log.debug(`[Bluetooth] Discovered Ruuvi data from ${mac}`);
            this.processRuuviData(mac, rawHexData);
          }
        }
      }
    });
  }

  setupWebhookServer() {
    const port = this.config.gateway.port || 8080;

    const server = http.createServer((req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
          try {
            const payload = JSON.parse(body) as GatewayPayload;
            if (payload.data && payload.data.tags) {
              for (const [mac, tagData] of Object.entries(payload.data.tags)) {
                const rawHexData = tagData.data;
                this.processRuuviData(mac.toUpperCase(), rawHexData);
              }
            }
            res.writeHead(200); res.end('OK');
          } catch {
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

  processRuuviData(mac: string, rawHexData: string) {
    const formattedMac = mac.toUpperCase();
    const configuredTags = (this.config.tags || []) as RuuviTagConfig[];
    const deviceConfig = configuredTags.find((t) => t.mac.toUpperCase() === formattedMac);

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