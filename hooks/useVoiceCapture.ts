import { useCallback, useRef } from 'react';
import {
  useAudioRecorder,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
} from 'expo-audio';

// VAD casero sobre el medidor de volumen (dB; ~-160 silencio, ~-20 voz fuerte).
// Los umbrales pueden necesitar ajuste fino según micrófono y ruido de fondo.
const SPEECH_DB = -30;             // por encima de esto = la persona habla
const SILENCE_HANG_MS = 1100;      // silencio sostenido tras hablar = cortar y enviar
const MIN_SPEECH_MS = 350;         // voz más corta que esto se descarta como ruido
const MAX_UTTERANCE_MS = 20000;    // tope duro por turno
const NO_SPEECH_TIMEOUT_MS = 8000; // si nunca habla, soltar el turno
const POLL_MS = 120;               // frecuencia de muestreo del medidor

export type CancelRef = { current: boolean };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function useVoiceCapture() {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    const current = await getRecordingPermissionsAsync();
    if (current.granted) return true;
    const requested = await requestRecordingPermissionsAsync();
    return requested.granted;
  }, []);

  // Graba hasta detectar silencio sostenido tras hablar (auto-send). Devuelve la
  // uri del audio, o null si no hubo voz / se canceló / falló.
  const recordUntilSilence = useCallback(async (cancel: CancelRef): Promise<string | null> => {
    async function safeStop() {
      try { if (recorder.isRecording) await recorder.stop(); } catch { /* ignore */ }
    }

    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();

      const startedAt = Date.now();
      let speechDetected = false;
      let firstLoudAt = 0;
      let lastLoudAt = Date.now();
      let loudMs = 0;

      while (true) {
        await sleep(POLL_MS);
        if (cancel.current) { await safeStop(); return null; }

        const level = recorder.getStatus().metering ?? -160;
        const now = Date.now();

        if (level > SPEECH_DB) {
          if (!firstLoudAt) firstLoudAt = now;
          loudMs += POLL_MS;
          lastLoudAt = now;
          // Solo cuenta como habla tras voz sostenida, para filtrar picos de ruido.
          if (loudMs >= MIN_SPEECH_MS) speechDetected = true;
        }

        if (speechDetected && now - lastLoudAt >= SILENCE_HANG_MS) break;
        if (!speechDetected && now - startedAt >= NO_SPEECH_TIMEOUT_MS) { await safeStop(); return null; }
        if (now - startedAt >= MAX_UTTERANCE_MS) break;
      }

      await safeStop();
      if (cancel.current || !speechDetected) return null;
      return recorder.uri ?? null;
    } catch (e) {
      console.error('recordUntilSilence error', e);
      try { if (recorder.isRecording) await recorder.stop(); } catch { /* ignore */ }
      return null;
    }
  }, [recorder]);

  return { recordUntilSilence, ensurePermission };
}
