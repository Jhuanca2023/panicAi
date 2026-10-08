export type HeartRateSample = {
  bpm: number;
  timestamp: number; // epoch ms
  source?: 'mock' | 'healthConnect' | 'bluetooth';
};

// Dispositivo/app de origen detectado en Health Connect; null si no se pudo determinar.
export type HeartRateDevice = { name: string } | null;

export type HeartRateStatus =
  | 'idle'         // no iniciado
  | 'connecting'   // solicitando permisos / inicializando
  | 'connected'    // conectado (BLE: enlace establecido, aún sin datos)
  | 'active'       // recibiendo datos
  | 'unavailable'; // sin datos / permisos denegados

export type MockPhase = 'resting' | 'rising' | 'panic' | 'falling';

export interface HeartRateProvider {
  // El provider BLE arranca de forma síncrona; mock/healthConnect son async.
  start(): void | Promise<void>;
  stop(): void;
  onSample(cb: (sample: HeartRateSample) => void): () => void;
  onStatus(cb: (status: HeartRateStatus) => void): () => void;
  // Opcional: notifica el dispositivo/app de origen detectado (Health Connect).
  onDevice?(cb: (device: HeartRateDevice) => void): () => void;
  // Opcional: dispara la simulación de pánico (mock y feed híbrido del reloj).
  triggerPanic?(): void;
}
