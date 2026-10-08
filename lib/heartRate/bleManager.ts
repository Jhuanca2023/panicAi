import { BleManager } from 'react-native-ble-plx';

// react-native-ble-plx es nativo y no existe en Expo Go (el constructor lanza),
// así que degradamos a null en vez de crashear al importar.
let manager: BleManager | null = null;
try {
  manager = new BleManager();
} catch (e) {
  console.warn('[bleManager] Bluetooth no disponible (¿Expo Go?). BLE deshabilitado.', e);
  manager = null;
}

export const bleManager = manager;
