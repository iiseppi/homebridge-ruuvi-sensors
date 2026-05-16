import { Service, PlatformAccessory } from 'homebridge';
import { RuuviSensorsPlatform } from './platform.js';

// Ohitetaan TypeScriptin tyyppitarkistus tälle vanhemmalle JS-kirjastolle
// @ts-ignore
import fakegato from 'fakegato-history';

export class RuuviPlatformAccessory {
  private tempService: Service;
  private humidityService: Service;
  private batteryService: Service;
  private historyService: any;

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

    // KORJAUS: Service.Battery (ei BatteryService)
    this.batteryService = this.accessory.getService(this.platform.Service.Battery) || 
                          this.accessory.addService(this.platform.Service.Battery);

    this.historyService = new FakeGatoHistoryService('weather', this.accessory, {
      log: this.platform.log,
      storage: 'fs',
      minutes: 10,
    });
  }

  public updateData(rawHexData: string) {
    try {
      const parsedData = this.parseRuuviData(rawHexData);

      if (!parsedData) {
        return;
      }

      this.platform.log.debug(`[${this.accessory.displayName}] Parsed: Temp ${parsedData.temperature}°C, Hum ${parsedData.humidity}%`);

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
      this.platform.log.error(`[${this.accessory.displayName}] Data parsing error:`, error);
    }
  }

  private parseRuuviData(hex: string): any {
    const ruuviHeaderIndex = hex.toUpperCase().indexOf('FF9904');
    if (ruuviHeaderIndex === -1) {
      return null;
    }

    const payload = hex.substring(ruuviHeaderIndex + 6);
    const dataFormat = parseInt(payload.substring(0, 2), 16);

    if (dataFormat === 5 && payload.length >= 48) {
      const tempHex = payload.substring(2, 6);
      let temperature = parseInt(tempHex, 16);
      if (temperature > 32767) {
        temperature -= 65536;
      }
      temperature = temperature * 0.005;

      const humHex = payload.substring(6, 10);
      const humidity = parseInt(humHex, 16) * 0.0025;

      const pressHex = payload.substring(10, 14);
      const pressure = (parseInt(pressHex, 16) + 50000) / 100;

      const powerHex = payload.substring(26, 30);
      const powerInfo = parseInt(powerHex, 16);
      const batteryVoltage = (powerInfo >>> 5) + 1600;

      return {
        temperature: Math.round(temperature * 100) / 100,
        humidity: Math.round(humidity * 100) / 100,
        pressure: Math.round(pressure * 10) / 10,
        batteryVoltage: batteryVoltage,
      };
    }

    return null; 
  }
}