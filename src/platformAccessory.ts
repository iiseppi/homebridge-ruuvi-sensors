import { Service, PlatformAccessory } from 'homebridge';
import { RuuviSensorsPlatform } from './platform.js';
// Tuodaan uusi yhteinen parseri
import { parseRuuviPayload } from './ruuviParser.js'; 

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
      // Haetaan mahdollinen salausavain laitteen contextista (Format 8 -purkua varten)
      const decryptionKey = this.accessory.context.device.dataFormat8Key;

      // Kutsutaan uutta parseria, joka hanskaa kaikki eri formaatit
      const parsedData = parseRuuviPayload(rawHexData, decryptionKey);

      if (!parsedData) {
        return;
      }

      // Lokitetaan myös käytetty dataformaatti (esim. Fmt 5 tai Fmt 8)
      this.platform.log.debug(
        `[${this.accessory.displayName}] Fmt ${parsedData.dataFormat} -> Temp ${parsedData.temperature}°C, Hum ${parsedData.humidity}%`,
      );

      // Päivitetään HomeKit-arvot reaaliajassa
      this.tempService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, parsedData.temperature);
      this.humidityService.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, parsedData.humidity);

      // Pariston tilan päivitys, jos data sisältää jännitteen
      if (parsedData.batteryVoltage) {
        const batteryLevel = Math.max(0, Math.min(100, ((parsedData.batteryVoltage - 2500) / 500) * 100));
        this.batteryService.updateCharacteristic(this.platform.Characteristic.BatteryLevel, batteryLevel);
        
        const lowBatteryStatus = batteryLevel < 20 
          ? this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW 
          : this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
        this.batteryService.updateCharacteristic(this.platform.Characteristic.StatusLowBattery, lowBatteryStatus);
      }

      // Tallennetaan historiamerkintä Eve-sovellusta varten
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