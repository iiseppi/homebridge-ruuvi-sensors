import { Service, PlatformAccessory } from 'homebridge';
import { RuuviSensorsPlatform } from './platform.js';
import { parseRuuviPayload } from './ruuviParser.js'; 

// KORJAUS: Käytetään ts-expect-erroria linterin vaatimuksesta
// @ts-expect-error - fakegato-history lacks official typescript definitions
import fakegato from 'fakegato-history';

interface FakeGatoHistoryInstance {
  addEntry(entry: {
    time: number;
    temp: number;
    humidity: number;
    pressure: number;
  }): void;
}

export class RuuviPlatformAccessory {
  private tempService: Service;
  private humidityService: Service;
  private batteryService: Service;
  private historyService: FakeGatoHistoryInstance;

  constructor(
    private readonly platform: RuuviSensorsPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    const FakeGatoHistoryService = fakegato(this.platform.api);

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Ruuvi Innovations')
      .setCharacteristic(this.platform.Characteristic.Model, 'RuuviTag')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.mac);

    this.tempService = this.accessory.getService(this.platform.Service.TemperatureSensor) || 
                       this.accessory.addService(this.platform.Service.TemperatureSensor);

    this.humidityService = this.accessory.getService(this.platform.Service.HumiditySensor) || 
                           this.accessory.addService(this.platform.Service.HumiditySensor);

    this.batteryService = this.accessory.getService(this.platform.Service.Battery) || 
                          this.accessory.addService(this.platform.Service.Battery);

    this.historyService = new FakeGatoHistoryService('weather', this.accessory, {
      log: this.platform.log,
      storage: 'fs',
      minutes: 10,
    }) as FakeGatoHistoryInstance;
  }

  public updateData(rawHexData: string) {
    try {
      const decryptionKey = this.accessory.context.device.dataFormat8Key as string | undefined;
      const parsedData = parseRuuviPayload(rawHexData, decryptionKey);

      if (!parsedData) {
        return;
      }

      this.platform.log.debug(
        `[${this.accessory.displayName}] Fmt ${parsedData.dataFormat} -> Temp ${parsedData.temperature}°C, Hum ${parsedData.humidity}%`,
      );

      this.tempService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, parsedData.temperature);
      this.humidityService.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, parsedData.humidity);

      if (parsedData.batteryVoltage) {
        const batteryLevel = Math.max(0, Math.min(100, ((parsedData.batteryVoltage - 2500) / 500) * 100));
        this.batteryService.updateCharacteristic(this.platform.Characteristic.BatteryLevel, batteryLevel);
        
        const lowBatteryStatus = batteryLevel < 20 
          ? this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW 
          : this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
        this.batteryService.updateCharacteristic(this.platform.Characteristic.StatusLowBattery, lowBatteryStatus);
      }

      this.historyService.addEntry({
        time: Math.round(new Date().valueOf() / 1000),
        temp: parsedData.temperature,
        humidity: parsedData.humidity,
        pressure: parsedData.pressure || 0,
      });

    } catch (error) {
      this.platform.log.error(`[${this.accessory.displayName}] Data processing error:`, error);
    }
  }
}