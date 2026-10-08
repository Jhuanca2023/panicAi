import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Preferencias de TTS guardadas en local (AsyncStorage): el voiceId es propio del
// dispositivo, así que no tiene sentido sincronizarlo entre equipos.
const TTS_ENABLED_KEY = '@panicai:tts_enabled';
const VOICE_ID_KEY = '@panicai:voice_id';

type SpeechSettingsValue = {
  ttsEnabled: boolean;
  voiceId: string | null;
  setTtsEnabled: (v: boolean) => void;
  setVoiceId: (id: string | null) => void;
};

const SpeechSettingsContext = createContext<SpeechSettingsValue | null>(null);

export function SpeechSettingsProvider({ children }: { children: ReactNode }) {
  const [ttsEnabled, setTtsEnabledState] = useState(true);
  const [voiceId, setVoiceIdState] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.multiGet([TTS_ENABLED_KEY, VOICE_ID_KEY]).then((entries) => {
      const map = Object.fromEntries(entries);
      if (map[TTS_ENABLED_KEY] === 'false') setTtsEnabledState(false);
      if (map[VOICE_ID_KEY]) setVoiceIdState(map[VOICE_ID_KEY]);
    }).catch(() => {});
  }, []);

  function setTtsEnabled(v: boolean) {
    setTtsEnabledState(v);
    AsyncStorage.setItem(TTS_ENABLED_KEY, v ? 'true' : 'false').catch(() => {});
  }

  function setVoiceId(id: string | null) {
    setVoiceIdState(id);
    if (id) AsyncStorage.setItem(VOICE_ID_KEY, id).catch(() => {});
    else AsyncStorage.removeItem(VOICE_ID_KEY).catch(() => {});
  }

  return (
    <SpeechSettingsContext.Provider value={{ ttsEnabled, voiceId, setTtsEnabled, setVoiceId }}>
      {children}
    </SpeechSettingsContext.Provider>
  );
}

export function useSpeechSettings() {
  const ctx = useContext(SpeechSettingsContext);
  if (!ctx) throw new Error('useSpeechSettings must be used within SpeechSettingsProvider');
  return ctx;
}
