import { useCallback, useEffect, useRef, useState } from 'react';
import { MockHeartRateProvider } from '../lib/heartRate/MockProvider';
import { HealthConnectProvider } from '../lib/heartRate/HealthConnectProvider';
import { BluetoothHeartRateProvider } from '../lib/heartRate/BluetoothProvider';
import type {
  HeartRateProvider, HeartRateSample, HeartRateStatus, HeartRateDevice,
} from '../lib/heartRate/types';
import { supabase } from '../lib/supabase';

export type HeartRateSource = 'off' | 'mock' | 'healthConnect' | 'bluetooth';

const HISTORY_SIZE = 30;

// Device BLE seleccionado (global): la pantalla de dispositivos lo setea al conectar.
let selectedBluetoothDeviceId: string | null = null;
export function setSelectedBluetoothDevice(deviceId: string | null) {
  selectedBluetoothDeviceId = deviceId;
}

export function useHeartRate(source: HeartRateSource = 'mock', bluetoothDeviceId?: string | null) {
  const providerRef = useRef<HeartRateProvider | null>(null);
  const [samples,    setSamples]    = useState<HeartRateSample[]>([]);
  const [status,     setStatus]     = useState<HeartRateStatus>('idle');
  const [currentBpm, setCurrentBpm] = useState<number | null>(null);
  const [device,     setDevice]     = useState<HeartRateDevice>(null);
  // Fuente real en uso: puede degradar a 'mock' si la elegida no está disponible.
  const [actualSource, setActualSource] = useState<HeartRateSource>(source);

  useEffect(() => {
    let active = true;

    providerRef.current?.stop();
    providerRef.current = null;

    setSamples([]);
    setCurrentBpm(null);
    setStatus('idle');
    setDevice(null);
    setActualSource(source);

    if (source === 'off') return;

    let subs: {
      unsubSample: () => void;
      unsubStatus: () => void;
      unsubDevice?: () => void;
    } | undefined;

    // Un deviceId explícito (switch entre varios) manda sobre el global.
    if (source === 'bluetooth' && bluetoothDeviceId) {
      selectedBluetoothDeviceId = bluetoothDeviceId;
    }

    async function initialize() {
      // Sin ID en memoria, recuperamos el último device BLE conectado guardado en Supabase.
      if (source === 'bluetooth' && !selectedBluetoothDeviceId) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            const { data, error } = await supabase
              .from('devices')
              .select('model')
              .eq('user_id', session.user.id)
              .eq('is_connected', true)
              .eq('type', 'heart_rate_monitor')
              .order('last_seen_at', { ascending: false })
              .limit(1);
            if (!error && data && data.length > 0 && active) {
              selectedBluetoothDeviceId = data[0].model;
            }
          }
        } catch (e) {
          console.warn('[useHeartRate] Error auto-recuperando dispositivo BLE:', e);
        }
      }
      if (!active) return;

      let provider: HeartRateProvider;
      try {
        if (source === 'mock') {
          provider = new MockHeartRateProvider();
        } else if (source === 'bluetooth') {
          provider = BluetoothHeartRateProvider.getInstance(selectedBluetoothDeviceId || undefined);
        } else {
          provider = new HealthConnectProvider();
        }
      } catch (e) {
        console.warn('[useHeartRate] Provider no disponible, usando mock:', e);
        provider = new MockHeartRateProvider();
        if (active) setActualSource('mock');
      }
      if (!active) { provider.stop(); return; }

      providerRef.current = provider;

      const unsubSample = provider.onSample(sample => {
        if (!active) return;
        setCurrentBpm(sample.bpm);
        setSamples(prev => {
          const next = [...prev, sample];
          return next.length > HISTORY_SIZE ? next.slice(-HISTORY_SIZE) : next;
        });
      });

      const unsubStatus = provider.onStatus(newStatus => {
        if (!active) return;
        // Health Connect sin datos/permisos: degradamos a mock.
        if (source === 'healthConnect' && newStatus === 'unavailable') {
          setActualSource('mock');
        }
        setStatus(newStatus);
      });

      const unsubDevice = provider.onDevice?.(d => { if (active) setDevice(d); });

      provider.start();
      subs = { unsubSample, unsubStatus, unsubDevice };
    }

    const initPromise = initialize();

    return () => {
      active = false;
      initPromise.then(() => {
        subs?.unsubSample();
        subs?.unsubStatus();
        subs?.unsubDevice?.();
      });
      providerRef.current?.stop();
    };
  }, [source, bluetoothDeviceId]);

  // Solo el mock y el feed de Health Connect lo soportan; no-op en BLE.
  const triggerPanic = useCallback(() => {
    providerRef.current?.triggerPanic?.();
  }, []);

  return { samples, status, currentBpm, device, triggerPanic, actualSource };
}
