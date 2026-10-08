import { Platform } from 'react-native';
import { bleManager } from './bleManager';
import type { HeartRateProvider, HeartRateSample, HeartRateStatus } from './types';
import type { Subscription, Device } from 'react-native-ble-plx';

const HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID = '00002a37-0000-1000-8000-00805f9b34fb';

function base64ToBytes(base64: string): Uint8Array {
  try {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const bytes = new Uint8Array(Math.floor(base64.length * 0.75));
    let count = 0;
    for (let i = 0; i < base64.length; i += 4) {
      const chunk = (chars.indexOf(base64[i]) << 18) |
        (chars.indexOf(base64[i + 1]) << 12) |
        ((base64[i + 2] === '=' ? 0 : chars.indexOf(base64[i + 2])) << 6) |
        (base64[i + 3] === '=' ? 0 : chars.indexOf(base64[i + 3]));
      bytes[count++] = (chunk >> 16) & 0xFF;
      if (base64[i + 2] !== '=') bytes[count++] = (chunk >> 8) & 0xFF;
      if (base64[i + 3] !== '=') bytes[count++] = chunk & 0xFF;
    }
    return bytes.slice(0, count);
  } catch (e) {
    console.error('[BluetoothProvider] Error decodificando string Base64:', e);
    return new Uint8Array(0);
  }
}

// Decodifica el perfil estándar de Heart Rate Measurement (flag de 8/16 bits).
function decodeHeartRate(base64Value: string): number | null {
  try {
    const decodedBytes = base64ToBytes(base64Value);
    if (decodedBytes.length < 2) return null;

    const flags = decodedBytes[0];
    const is16Bit = (flags & 0x01) !== 0;

    if (is16Bit) {
      if (decodedBytes.length < 3) return null;
      return decodedBytes[1] | (decodedBytes[2] << 8);
    } else {
      return decodedBytes[1];
    }
  } catch (error) {
    console.error('[BluetoothProvider] Error decodificando ritmo cardíaco estándar:', error);
    return null;
  }
}

// Heurística para extraer el BPM de pulseras con protocolo propio (FitPro, Lefun, etc.).
function parseCustomBpm(bytes: Uint8Array): number | null {
  if (bytes.length === 0) return null;

  //  Si es un solo byte, y está en un rango lógico humano (40-200), el ritmo cardíaco directo
  if (bytes.length === 1 && bytes[0] >= 40 && bytes[0] <= 200) {
    return bytes[0];
  }

  //  Si empieza con 0xAB o 0xCD
  if (bytes[0] === 0xab || bytes[0] === 0xcd) {
    // Buscamos si en los primeros bytes está la clave de telemetría de ritmo cardíaco
    if (bytes.length >= 7 && (bytes[1] === 0x09 || bytes[4] === 0x09 || bytes[4] === 0x31 || bytes[4] === 0x32)) {
      for (let i = 5; i < bytes.length - 1; i++) {
        if (bytes[i] >= 40 && bytes[i] <= 220) {
          return bytes[i];
        }
      }
    }
  }

  // Fallback , buscar cualquier byte en rango cardíaco lógico (40-200)
  // que esté precedido por un identificador de tipo (como 0x09, 0x0a, 0x02, 0x31, 0x32)
  for (let i = bytes.length - 1; i >= 1; i--) {
    const val = bytes[i];
    if (val >= 40 && val <= 200 && val !== 0xab && val !== 0xcd && val !== 0xff && val !== 0x00) {
      const prev = bytes[i - 1];
      if (prev === 0x09 || prev === 0x0a || prev === 0x02 || prev === 0x31 || prev === 0x32) {
        return val;
      }
    }
  }

  return null;
}

export class BluetoothHeartRateProvider implements HeartRateProvider {
  private static instance: BluetoothHeartRateProvider | null = null;

  public static getInstance(deviceId?: string): BluetoothHeartRateProvider {
    if (!BluetoothHeartRateProvider.instance) {
      BluetoothHeartRateProvider.instance = new BluetoothHeartRateProvider(deviceId);
    } else if (deviceId) {
      BluetoothHeartRateProvider.instance.setDevice(deviceId);
    }
    return BluetoothHeartRateProvider.instance;
  }

  private deviceId: string | null = null;
  private sampleCallbacks: ((sample: HeartRateSample) => void)[] = [];
  private statusCallbacks: ((status: HeartRateStatus) => void)[] = [];
  private subscriptions: Subscription[] = [];
  private connectedDevice: Device | null = null;
  private status: HeartRateStatus = 'idle';
  private isRunning = false;
  private referenceCount = 0;
  private isConnecting = false;

  constructor(deviceId?: string) {
    this.deviceId = deviceId || null;
  }

  setDevice(deviceId: string) {
    this.deviceId = deviceId;
  }

  onSample(callback: (sample: HeartRateSample) => void): () => void {
    this.sampleCallbacks.push(callback);
    return () => {
      this.sampleCallbacks = this.sampleCallbacks.filter(cb => cb !== callback);
    };
  }

  onStatus(callback: (status: HeartRateStatus) => void): () => void {
    this.statusCallbacks.push(callback);
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
    };
  }

  start() {
    this.referenceCount++;
    console.log(`[BluetoothProvider] start() llamado. refCount: ${this.referenceCount}, isRunning: ${this.isRunning}`);

    if (this.isRunning) {
      this.updateStatus(this.status);
      return;
    }

    this.isRunning = true;
    this.connectAndSubscribe();
  }

  private async connectAndSubscribe() {
    if (!this.deviceId || !this.isRunning || this.isConnecting) return;

    // Sin módulo nativo BLE (p. ej. Expo Go) no podemos conectar.
    if (!bleManager) {
      this.updateStatus('unavailable');
      return;
    }

    this.isConnecting = true;
    this.updateStatus('connecting');
    console.log(`[BluetoothProvider] Conectando al dispositivo BLE: ${this.deviceId}`);

    try {
      const device = await bleManager.connectToDevice(this.deviceId, { autoConnect: false });
      this.connectedDevice = device;
      this.updateStatus('connected');
      console.log('[BluetoothProvider] Conectado. Descubriendo servicios...');

      device.onDisconnected((error, disconnectedDevice) => {
        console.log('[BluetoothProvider] Dispositivo desconectado:', error ? error.message : 'Desconexión limpia');
        this.connectedDevice = null;
        this.updateStatus('unavailable');

        // Limpiamos las suscripciones locales
        this.subscriptions.forEach(sub => sub.remove());
        this.subscriptions = [];

        if (this.isRunning) {
          // Intentar reconectar tras 5 segundos
          setTimeout(() => {
            if (this.isRunning && !this.connectedDevice) {
              console.log('[BluetoothProvider] Intentando reconexión automática...');
              this.connectAndSubscribe();
            }
          }, 5000);
        }
      });

      await device.discoverAllServicesAndCharacteristics();
      this.updateStatus('active');

      // Limpiamos suscripciones anteriores
      this.subscriptions.forEach(sub => sub.remove());
      this.subscriptions = [];

      const services = await device.services();
      console.log('[BluetoothProvider] === DETECTANDO CARACTERÍSTICAS Y SUSCRIBIÉNDOSE A NOTIFICACIONES ===');

      for (const service of services) {
        try {
          const characteristics = await service.characteristics();
          for (const char of characteristics) {
            console.log(`[BluetoothProvider] Char: ${char.uuid} | Servicio: ${service.uuid}`);

            // Si la característica es notifiable (permite recibir datos en tiempo real)
            if (char.isNotifiable) {
              console.log(`[BluetoothProvider] -> Suscribiéndose a canal: ${char.uuid}`);

              const sub = device.monitorCharacteristicForService(
                service.uuid,
                char.uuid,
                (error, updatedChar) => {
                  if (error) return;
                  if (updatedChar?.value) {
                    const bytes = base64ToBytes(updatedChar.value);
                    const hexString = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');

                    console.log(`[BluetoothProvider] [NOTIFY] Recibido en ${updatedChar.uuid} (HEX): ${hexString}`);

                    let bpm: number | null = null;
                    if (updatedChar.uuid.toLowerCase().includes(HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID.toLowerCase())) {
                      bpm = decodeHeartRate(updatedChar.value);
                    } else {
                      bpm = parseCustomBpm(bytes);
                    }

                    if (bpm !== null) {
                      console.log(`[BluetoothProvider] [EXITO] Ritmo cardíaco decodificado en ${updatedChar.uuid}: ${bpm} BPM`);
                      this.emitSample(bpm);
                    }
                  }
                }
              );
              this.subscriptions.push(sub);
            }
          }
        } catch (charError) {
          console.log(`[BluetoothProvider] No se pudieron leer características del servicio ${service.uuid}:`, charError);
        }
      }

      if (this.subscriptions.length === 0) {
        console.warn('[BluetoothProvider] Advertencia: No se encontraron canales de notificación (Notify) en este dispositivo.');
        this.updateStatus('unavailable');
      } else {
        console.log(`[BluetoothProvider] Listo. Escuchando datos en ${this.subscriptions.length} canales activos.`);
      }

    } catch (err) {
      console.warn('[BluetoothProvider] Conexión o descubrimiento fallido:', err);
      this.updateStatus('unavailable');

      if (this.isRunning) {
        setTimeout(() => {
          if (this.isRunning && !this.connectedDevice) {
            console.log('[BluetoothProvider] Reintentando conexión tras fallo inicial...');
            this.connectAndSubscribe();
          }
        }, 5000);
      }
    } finally {
      this.isConnecting = false;
    }
  }

  stopRealConnection() {
    this.isConnecting = false;
    if (this.subscriptions.length > 0) {
      this.subscriptions.forEach(sub => sub.remove());
      this.subscriptions = [];
    }
    if (this.connectedDevice) {
      const dev = this.connectedDevice;
      this.connectedDevice = null;
      dev.cancelConnection()
        .then(() => console.log('[BluetoothProvider] Conexión cancelada exitosamente'))
        .catch(err => console.warn('[BluetoothProvider] Error al cancelar la conexión:', err));
    }
  }

  stop() {
    this.referenceCount--;
    console.log(`[BluetoothProvider] stop() llamado. refCount restante: ${this.referenceCount}`);

    if (this.referenceCount > 0) {
      console.log(`[BluetoothProvider] Mantenemos conexión activa porque otros componentes la están usando.`);
      return;
    }

    if (this.referenceCount < 0) this.referenceCount = 0;
    this.isRunning = false;
    this.stopRealConnection();
    this.updateStatus('idle');
  }

  private emitSample(bpm: number) {
    const sample: HeartRateSample = {
      timestamp: Date.now(),
      bpm: bpm,
      source: 'bluetooth'
    };
    this.sampleCallbacks.forEach(cb => cb(sample));
  }

  private updateStatus(newStatus: HeartRateStatus) {
    this.status = newStatus;
    this.statusCallbacks.forEach(cb => cb(newStatus));
  }
}
