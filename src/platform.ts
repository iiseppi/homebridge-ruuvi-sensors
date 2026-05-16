import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import * as http from 'http';
// Otetaan tämä nyt mukaan, koska luomme tiedoston seuraavaksi:
import { RuuviPlatformAccessory } from './platformAccessory.js';

export class RuuviSensorsPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  public readonly accessories: Map<string, PlatformAccessory> = new Map();

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    // Alustetaan nämä vasta täällä, jotta this.api on varmasti olemassa
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      this.log.debug('Executed didFinishLaunching callback');
      
      if (this.config.gateway && this.config.gateway.enabled) {
        this.setupWebhookServer();
      }

      if (this.config.bluetooth && this.config.bluetooth.enabled) {
        this.log.info('Bluetooth scanning will be initialized here later.');
      }
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.set(accessory.context.device.mac, accessory);
  }

  setupWebhookServer() {
    const port = this.config.gateway.port || 8080;

    const server = http.createServer((req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        
        req.on('end', () => {
          try {
            const payload = JSON.parse(body);
            this.handleGatewayData(payload);
            res.writeHead(200);
            res.end('OK');
          } catch (error) {
            this.log.error('Failed to parse Webhook payload:', error);
            res.writeHead(400);
            res.end('Bad Request');
          }
        });
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(port, () => {
      this.log.info(`Ruuvi Gateway Webhook server listening on port ${port}`);
    });
  }

  handleGatewayData(payload: any) {
    if (!payload.data || !payload.data.tags) {
      return;
    }

    const tags = payload.data.tags;
    
    for (const [mac, tagData] of Object.entries(tags)) {
      const formattedMac = mac.toUpperCase();
      const rawHexData = (tagData as any).data;

      const configuredTags = this.config.tags || [];
      const deviceConfig = configuredTags.find((t: any) => t.mac.toUpperCase() === formattedMac);

      if (!deviceConfig) {
        continue;
      }

      let accessory = this.accessories.get(formattedMac);

      if (!accessory) {
        this.log.info('Adding new RuuviTag:', deviceConfig.name);
        const uuid = this.api.hap.uuid.generate(formattedMac);
        accessory = new this.api.platformAccessory(deviceConfig.name, uuid);
        accessory.context.device = deviceConfig;

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessories.set(formattedMac, accessory);
      } else {
        accessory.context.device = deviceConfig;
      }

      // Siirretään raakadata eteenpäin laitteelle parsittavaksi!
      const accessoryHandler = new RuuviPlatformAccessory(this, accessory);
      accessoryHandler.updateData(rawHexData);
    }
  }
}