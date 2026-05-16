import * as crypto from 'crypto';

export interface RuuviMeasurement {
  dataFormat: number;
  temperature: number;
  humidity: number;
  pressure: number;
  batteryVoltage?: number;
}

// --- FORMAATTI 3 (RAWv1) ---
function parseFormat3(payload: string): RuuviMeasurement | null {
  if (payload.length < 28) {
    return null;
  }
  
  const humidity = parseInt(payload.substring(2, 4), 16) * 0.5;
  
  let temperature = parseInt(payload.substring(4, 6), 16);
  const tempFraction = parseInt(payload.substring(6, 8), 16) / 100;
  if (temperature > 127) {
    temperature -= 256;
  }
  temperature = temperature + (temperature >= 0 ? tempFraction : -tempFraction);

  const pressure = (parseInt(payload.substring(8, 12), 16) + 50000) / 100;
  const batteryVoltage = parseInt(payload.substring(24, 28), 16);

  return {
    dataFormat: 3,
    temperature: Math.round(temperature * 100) / 100,
    humidity: Math.round(humidity * 100) / 100,
    pressure: Math.round(pressure * 10) / 10,
    batteryVoltage,
  };
}

// --- FORMAATTI 5 (RAWv2) ---
function parseFormat5(payload: string): RuuviMeasurement | null {
  if (payload.length < 48) {
    return null;
  }

  let temperature = parseInt(payload.substring(2, 6), 16);
  if (temperature > 32767) {
    temperature -= 65536;
  }
  temperature = temperature * 0.005;

  const humidity = parseInt(payload.substring(6, 10), 16) * 0.0025;
  const pressure = (parseInt(payload.substring(10, 14), 16) + 50000) / 100;

  const powerInfo = parseInt(payload.substring(26, 30), 16);
  const batteryVoltage = (powerInfo >>> 5) + 1600;

  return {
    dataFormat: 5,
    temperature: Math.round(temperature * 100) / 100,
    humidity: Math.round(humidity * 100) / 100,
    pressure: Math.round(pressure * 10) / 10,
    batteryVoltage,
  };
}

// --- FORMAATTI 8 (Salattu ympäristödata) ---
function parseFormat8(payload: string, keyHex?: string): RuuviMeasurement | null {
  if (!keyHex || keyHex.length !== 32) {
    return null;
  }
  if (payload.length < 48) {
    return null;
  }

  try {
    const cipherText = Buffer.from(payload.substring(2, 34), 'hex');
    const key = Buffer.from(keyHex, 'hex');
    const iv = Buffer.alloc(16, 0);

    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    decipher.setAutoPadding(false);
    let decrypted = decipher.update(cipherText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    const temperature = decrypted.readInt16BE(0) * 0.005;
    const humidity = decrypted.readUInt16BE(2) * 0.0025;
    const pressure = (decrypted.readUInt16BE(4) + 50000) / 100;

    return {
      dataFormat: 8,
      temperature: Math.round(temperature * 100) / 100,
      humidity: Math.round(humidity * 100) / 100,
      pressure: Math.round(pressure * 10) / 10,
    };
  } catch {
    return null;
  }
}

// --- FORMAATTI E1 (Extended Long Range) ---
function parseFormatE1(payload: string): RuuviMeasurement | null {
  if (payload.length < 24) {
    return null;
  }
  
  let temperature = parseInt(payload.substring(2, 6), 16);
  if (temperature > 32767) {
    temperature -= 65536;
  }
  temperature = temperature * 0.01;

  const humidity = parseInt(payload.substring(6, 10), 16) * 0.01;
  const pressure = parseInt(payload.substring(10, 14), 16) / 100;

  return {
    dataFormat: 0xE1,
    temperature: Math.round(temperature * 100) / 100,
    humidity: Math.round(humidity * 100) / 100,
    pressure: Math.round(pressure * 10) / 10,
  };
}

/**
 * Pääfunktio, joka on nyt sijoitettu apufunktioiden alapuolelle.
 */
export function parseRuuviPayload(hex: string, decryptionKey?: string): RuuviMeasurement | null {
  const hexUpper = hex.toUpperCase();
  const ruuviHeaderIndex = hexUpper.indexOf('FF9904');
  if (ruuviHeaderIndex === -1) {
    return null;
  }

  const payload = hexUpper.substring(ruuviHeaderIndex + 6);
  const dataFormat = parseInt(payload.substring(0, 2), 16);

  switch (dataFormat) {
  case 3:
    return parseFormat3(payload);
  case 5:
    return parseFormat5(payload);
  case 8:
    return parseFormat8(payload, decryptionKey);
  case 0xE1:
    return parseFormatE1(payload);
  default:
    return null;
  }
}