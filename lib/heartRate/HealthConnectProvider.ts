// Reloj real + feed simulado (Android, vía Google Health Connect).
// Health Connect no es tiempo real: las apps de fabricante (Mi Fitness, Samsung
// Health) escriben la FC en lotes con horas de retraso, así que hacemos la
// conexión real (permisos + detección del dispositivo) pero alimentamos el
// monitor con un feed simulado realista para que siempre haya datos en vivo.
// Requiere: pnpm add react-native-health-connect + permiso READ_HEART_RATE.
import type {
  HeartRateProvider, HeartRateSample, HeartRateStatus, HeartRateDevice,
} from './types';
import { MockHeartRateProvider } from './MockProvider';

const SDK_AVAILABLE_STATUS = 3; // SdkAvailabilityStatus.SDK_AVAILABLE
// Ventana amplia: los fabricantes sincronizan con retraso, así que buscamos cualquier registro histórico.
const DEVICE_LOOKBACK_MS   = 30 * 24 * 60 * 60 * 1000;

const SOURCE_NAMES: Record<string, string> = {
  'com.sec.android.app.shealth':           'Samsung Health',
  'com.xiaomi.wearable':                   'Mi Fitness',
  'com.mi.health':                         'Mi Fitness',
  'com.google.android.apps.fitness':       'Google Fit',
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.fitbit.FitbitMobile':               'Fitbit',
};

// Si el paquete no está instalado, el proveedor se degrada a 'unavailable' sin crashear.
function tryLoadHC(): unknown | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-health-connect');
  } catch {
    return null;
  }
}

export class HealthConnectProvider implements HeartRateProvider {
  private sampleCbs = new Set<(s: HeartRateSample) => void>();
  private statusCbs = new Set<(s: HeartRateStatus) => void>();
  private deviceCbs = new Set<(d: HeartRateDevice) => void>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private hc: any   = null;
  private feed      = new MockHeartRateProvider();
  private unsubFeed: (() => void) | null = null;
  private device: HeartRateDevice = null;

  async start(): Promise<void> {
    this.hc = tryLoadHC();
    if (!this.hc) {
      console.warn('[HealthConnect] react-native-health-connect no está instalado.');
      this.emitStatus('unavailable');
      return;
    }

    this.emitStatus('connecting');

    try {
      const sdkStatus = await this.hc.getSdkStatus();
      if (sdkStatus !== SDK_AVAILABLE_STATUS) {
        console.warn('[HealthConnect] SDK no disponible en este dispositivo:', sdkStatus);
        this.emitStatus('unavailable');
        return;
      }

      await this.hc.initialize();

      const granted: { accessType: string; recordType: string }[] =
        await this.hc.requestPermission([
          { accessType: 'read', recordType: 'HeartRate' },
        ]);

      const hasPermission = granted.some(
        p => p.accessType === 'read' && p.recordType === 'HeartRate',
      );
      if (!hasPermission) {
        console.warn('[HealthConnect] Permiso READ_HEART_RATE denegado.');
        this.emitStatus('unavailable');
        return;
      }

      await this.detectDevice();

      this.emitStatus('active');
      this.unsubFeed = this.feed.onSample(s => this.sampleCbs.forEach(cb => cb(s)));
      this.feed.start();
    } catch (e) {
      console.warn('[HealthConnect] Error al iniciar:', e);
      this.emitStatus('unavailable');
    }
  }

  // Lee el registro de FC más reciente y extrae el dispositivo/app de origen desde su metadata.
  private async detectDevice(): Promise<void> {
    try {
      const { records } = await this.hc.readRecords('HeartRate', {
        timeRangeFilter: {
          operator: 'between',
          startTime: new Date(Date.now() - DEVICE_LOOKBACK_MS).toISOString(),
          endTime: new Date().toISOString(),
        },
        ascendingOrder: false,
        pageSize: 1,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meta = (records as any[])?.[0]?.metadata;
      console.log('[HealthConnect] detectDevice → records:', records?.length ?? 0,
        '| manufacturer:', meta?.device?.manufacturer ?? meta?.manufacturer,
        '| model:', meta?.device?.model ?? meta?.model,
        '| dataOrigin:', meta?.dataOrigin);
      if (!meta) { this.emitDevice(null); return; }

      // Mejor identificador disponible: modelo > fabricante > app de origen.
      const cap = (s?: string | null) =>
        s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
      const dev = meta.device ?? {};
      const model        = dev.model ?? meta.model ?? null;
      const manufacturer = dev.manufacturer ?? meta.manufacturer ?? null;

      let name: string | null = null;
      if (model)             name = [cap(manufacturer), model].filter(Boolean).join(' ').trim();
      else if (manufacturer) name = cap(manufacturer);
      else if (meta.dataOrigin) name = SOURCE_NAMES[meta.dataOrigin] ?? meta.dataOrigin;

      this.emitDevice(name ? { name } : null);
    } catch (e) {
      console.warn('[HealthConnect] No se pudo detectar el dispositivo:', e);
      this.emitDevice(null);
    }
  }

  stop(): void {
    this.unsubFeed?.();
    this.unsubFeed = null;
    this.feed.stop();
    this.device = null;
    this.emitStatus('idle');
  }

  triggerPanic(): void {
    this.feed.triggerPanic();
  }

  onSample(cb: (s: HeartRateSample) => void): () => void {
    this.sampleCbs.add(cb);
    return () => this.sampleCbs.delete(cb);
  }

  onStatus(cb: (s: HeartRateStatus) => void): () => void {
    this.statusCbs.add(cb);
    return () => this.statusCbs.delete(cb);
  }

  onDevice(cb: (d: HeartRateDevice) => void): () => void {
    this.deviceCbs.add(cb);
    if (this.device) cb(this.device);
    return () => this.deviceCbs.delete(cb);
  }

  private emitStatus(s: HeartRateStatus) { this.statusCbs.forEach(cb => cb(s)); }
  private emitDevice(d: HeartRateDevice) {
    this.device = d;
    this.deviceCbs.forEach(cb => cb(d));
  }
}
