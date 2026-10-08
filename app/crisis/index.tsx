import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, Modal, AppState,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withTiming,
} from 'react-native-reanimated';
import { X, Phone, Mic, Wifi, Zap, Heart, Bot, MessageCircle, MessageSquare, Wind } from 'lucide-react-native';
import * as Speech from 'expo-speech';
import { setAudioModeAsync } from 'expo-audio';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { useProfile } from '../../hooks/useProfile';
import { useVoiceCapture, type CancelRef } from '../../hooks/useVoiceCapture';
import { useSpeechSettings } from '../../hooks/useSpeechSettings';
import { useHeartRate, type HeartRateSource } from '../../hooks/useHeartRate';
import {
  sendCrisisMessage,
  transcribeAudio,
  CrisisRateLimitError,
  type ChatMessage,
} from '../../lib/crisisChat';
import { getHRFeedback, buildFeedbackParams } from '../../lib/hrFeedback';
import { generateAndSaveEpisode } from '../../lib/episodes';
import { getLocationMapsLink, buildAlertMessage, sendWhatsApp, sendSMS } from '../../lib/emergencyAlert';
import { ConfirmModal } from '../../components/ConfirmModal';
import { BreathingGuide, type BreathingPattern } from '../../components/BreathingGuide';
import { EMERGENCY_LINES, isEmergencyLineCode, type ReferralCode } from '../../lib/emergencyLines';
import type { EmergencyContact } from '../../lib/crisisChat';
import type { TranslationKey } from '../../lib/translations';

const TTS_RATE  = 1.0;
const TTS_PITCH = 1.0;
const LINEA_113 = '113';
const CARDIAC_INTERVAL_MS = 30_000;
const MIN_SAMPLES_FOR_AI  = 3;
const TTS_OFF_HOLD_MS     = 2_600;
const MAX_SESSION_MS      = 30 * 60_000;
const INACTIVITY_MS       = 3 * 60_000;
const BACKGROUND_LIMIT_MS = 5 * 60_000;
const WATCHDOG_MS         = 20_000;

type VoiceStatus = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';

type CrisisDevice = { name: string; source: HeartRateSource; deviceId: string | null };

type StripMessage = {
  text: string;
  kind: 'voice' | 'cardiac';
  referral?: ReferralCode | null;
  contact?: EmergencyContact | null;
};

function zoneColor(bpm: number | null, danger: string): string {
  if (bpm === null) return '#94a3b8';
  if (bpm < 100) return '#22C55E';
  if (bpm < 130) return '#F59E0B';
  return danger;
}

export default function CrisisScreen() {
  const { colors } = useTheme();
  const { t, locale } = useTranslation();
  const { profile } = useProfile();
  const isPremium = profile?.plan === 'plus';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [hrSource, setHrSource] = useState<HeartRateSource>('off');
  const [hrDevices, setHrDevices] = useState<CrisisDevice[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const btDeviceId = hrSource === 'bluetooth' ? (hrDevices[activeIdx]?.deviceId ?? null) : null;
  const { samples, status: hrStatus, currentBpm, triggerPanic } = useHeartRate(hrSource, btDeviceId);
  const hrActive = hrSource !== 'off';
  const color = zoneColor(currentBpm, colors.danger);
  const activeDeviceName = hrSource === 'mock' ? null : (hrDevices[activeIdx]?.name ?? null);

  function zoneLabel() {
    if (!currentBpm) return t('monitorZoneUnknown');
    if (currentBpm < 60) return t('monitorZoneLow');
    if (currentBpm < 100) return t('monitorZoneNormal');
    if (currentBpm < 130) return t('monitorZoneElevated');
    return t('monitorZoneCrisis');
  }

  const [showBreathing, setShowBreathing] = useState(false);
  const [breathingPattern, setBreathingPattern] = useState<BreathingPattern>('478');

  const [emergencyOpen, setEmergencyOpen] = useState(false);

  const [confirmEnd, setConfirmEnd] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const [message, setMessage] = useState<StripMessage | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [micDenied, setMicDenied] = useState(false);
  const [rateLimited, setRateLimited] = useState<{ limit: number; used: number } | null>(null);

  const { recordUntilSilence, ensurePermission } = useVoiceCapture();
  const { ttsEnabled, voiceId } = useSpeechSettings();
  const voiceModeRef = useRef(false);
  const cancelRef = useRef<CancelRef>({ current: false }).current;
  const firstSentRef = useRef(false);
  const startedOnceRef = useRef(false);
  const historyRef = useRef<ChatMessage[]>([]);

  const episodeStartRef = useRef(Date.now());
  const lastReferralRef = useRef<string | null>(null);
  const hrStatsRef = useRef({ count: 0, sum: 0, min: Infinity, max: 0 });
  const savedRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const bgAtRef = useRef<number | null>(null);

  // Dos canales (voz + cardíaco) hablan en la misma franja: la cola serializa el TTS y la grabación espera a que termine.
  const speakingRef = useRef(false);
  const recordingRef = useRef(false);
  const queueRef = useRef<StripMessage[]>([]);
  const breathingRef = useRef(false);

  function speakNow(text: string): Promise<void> {
    if (!ttsEnabled) {
      return new Promise((resolve) => setTimeout(resolve, TTS_OFF_HOLD_MS));
    }
    return new Promise((resolve) => {
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      Speech.speak(text, {
        language: locale,
        voice: voiceId ?? undefined,
        rate: TTS_RATE,
        pitch: TTS_PITCH,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => resolve(),
      });
    });
  }

  const drainQueue = useCallback(async () => {
    if (speakingRef.current || recordingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;

    speakingRef.current = true;
    setMessage(next);
    setVoiceStatus('speaking');
    await speakNow(next.text);
    speakingRef.current = false;
    setVoiceStatus('idle');
    drainQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsEnabled, voiceId, locale]);

  const enqueueMessage = useCallback((m: StripMessage) => {
    queueRef.current.push(m);
    drainQueue();
  }, [drainQueue]);

  function waitUntilQuiet(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (!voiceModeRef.current) return resolve();
        if (!speakingRef.current && queueRef.current.length === 0 && !breathingRef.current) return resolve();
        setTimeout(check, 150);
      };
      check();
    });
  }

  function openBreathing(p: BreathingPattern) {
    setBreathingPattern(p);
    breathingRef.current = true;
    cancelRef.current = true;
    setShowBreathing(true);
  }
  function closeBreathing() {
    breathingRef.current = false;
    setShowBreathing(false);
  }

  //Graba el audio y lo transcribe
  async function voiceLoop() {
    while (voiceModeRef.current) {
      await waitUntilQuiet();
      if (!voiceModeRef.current) break;

      recordingRef.current = true;
      setVoiceStatus('listening');
      cancelRef.current = false;
      const uri = await recordUntilSilence(cancelRef);
      recordingRef.current = false;
      drainQueue();

      if (!voiceModeRef.current) break;
      if (!uri) continue;

      setVoiceStatus('transcribing');
      let text = '';
      try {
        text = await transcribeAudio(uri, locale);
      } catch {
        enqueueMessage({ text: t('crisisError'), kind: 'voice' });
      }
      if (!voiceModeRef.current) break;
      if (!text) continue;

      lastActivityRef.current = Date.now();
      setVoiceStatus('thinking');
      const history = [...historyRef.current, { role: 'user' as const, content: text }];
      historyRef.current = history;

      const isFirst = !firstSentRef.current;
      try {
        const { reply, referral, contact, breathing } = await sendCrisisMessage(history, {
          newSession: isFirst,
          locale,
        });
        firstSentRef.current = true;
        if (referral) lastReferralRef.current = referral;
        historyRef.current = [...history, { role: 'assistant', content: reply }];
        enqueueMessage({ text: reply, kind: 'voice', referral, contact });
        await waitUntilQuiet();
        // La respiración arranca recién después de que la IA terminó de hablar.
        if (breathing) openBreathing(breathing as BreathingPattern);
      } catch (e) {
        if (e instanceof CrisisRateLimitError) {
          setRateLimited({ limit: e.limit, used: e.used });
          stopVoice();
          break;
        }
        enqueueMessage({ text: t('crisisError'), kind: 'voice' });
      }
    }
    setVoiceStatus('idle');
  }

  function stopVoice() {
    voiceModeRef.current = false;
    cancelRef.current = true;
    Speech.stop();
    speakingRef.current = false;
    queueRef.current = [];
  }

  async function startVoice() {
    const granted = await ensurePermission();
    if (!granted) { setMicDenied(true); return; }
    setMicDenied(false);
    voiceModeRef.current = true;
    // Saludo inicial solo la primera vez; al reanudar no se reinicia el historial.
    if (!startedOnceRef.current) {
      startedOnceRef.current = true;
      historyRef.current = [{ role: 'assistant', content: t('crisisOpening') }];
      enqueueMessage({ text: t('crisisOpening'), kind: 'voice' });
    }
    voiceLoop();
  }

  // Guarda el resumen del episodio (idempotente, fire-and-forget) al cerrar por cualquier vía.
  function finalizeEpisode() {
    if (savedRef.current) return;
    savedRef.current = true;
    const s = hrStatsRef.current;
    const hr = s.count > 0
      ? { avg: Math.round(s.sum / s.count), min: Math.round(s.min), max: Math.round(s.max) }
      : null;
    const durationSec = Math.max(0, Math.round((Date.now() - episodeStartRef.current) / 1000));
    void generateAndSaveEpisode({
      messages: historyRef.current,
      hr,
      startedAt: episodeStartRef.current,
      durationSec,
      referral: lastReferralRef.current,
      locale,
    });
  }

  // Cierre desde "Ya me siento mejor": espera el resumen y lo muestra antes de cerrar.
  async function doFinish() {
    if (savedRef.current) { setConfirmEnd(false); router.back(); return; }
    savedRef.current = true;
    setConfirmEnd(false);
    stopVoice();

    const hasUserTurn = historyRef.current.some((m) => m.role === 'user');
    if (!hasUserTurn) { router.back(); return; }

    const s = hrStatsRef.current;
    const hr = s.count > 0
      ? { avg: Math.round(s.sum / s.count), min: Math.round(s.min), max: Math.round(s.max) }
      : null;
    const durationSec = Math.max(0, Math.round((Date.now() - episodeStartRef.current) / 1000));

    setFinishing(true);
    const ep = await generateAndSaveEpisode({
      messages: historyRef.current,
      hr,
      startedAt: episodeStartRef.current,
      durationSec,
      referral: lastReferralRef.current,
      locale,
    });
    if (ep) router.replace(`/historial/${ep.id}`);
    else router.back();
  }

  function endBySystem(present: boolean) {
    if (savedRef.current) return;
    if (present) {
      doFinish();
    } else {
      stopVoice();
      finalizeEpisode();
      router.back();
    }
  }

  function doCheckIn() {
    if (!voiceModeRef.current || speakingRef.current || breathingRef.current || queueRef.current.length > 0) return;
    lastActivityRef.current = Date.now();
    enqueueMessage({ text: t('crisisCheckin'), kind: 'voice' });
  }

  useEffect(() => {
    startVoice();
    return () => { stopVoice(); finalizeEpisode(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (savedRef.current) return;
      const now = Date.now();
      if (now - episodeStartRef.current >= MAX_SESSION_MS) {
        endBySystem(true);
        return;
      }
      if (now - lastActivityRef.current >= INACTIVITY_MS) {
        doCheckIn();
      }
    }, WATCHDOG_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const bgAt = bgAtRef.current;
        bgAtRef.current = null;
        if (savedRef.current) return;
        const now = Date.now();
        if ((bgAt && now - bgAt >= BACKGROUND_LIMIT_MS) || now - episodeStartRef.current >= MAX_SESSION_MS) {
          endBySystem(false);
        }
      } else if (bgAtRef.current == null) {
        bgAtRef.current = Date.now();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pausa la voz al perder el foco y la reanuda al volver: si no, expo-audio
  // crashea (IllegalStateException) al pausar el grabador en background.
  useFocusEffect(
    useCallback(() => {
      if (startedOnceRef.current && !voiceModeRef.current && !micDenied && !savedRef.current) {
        voiceModeRef.current = true;
        voiceLoop();
      }
      return () => {
        voiceModeRef.current = false;
        cancelRef.current = true;
        Speech.stop();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [micDenied]),
  );

  useEffect(() => {
    if (currentBpm == null) return;
    const s = hrStatsRef.current;
    s.count += 1;
    s.sum += currentBpm;
    s.min = Math.min(s.min, currentBpm);
    s.max = Math.max(s.max, currentBpm);
  }, [currentBpm]);

  const samplesRef = useRef(samples);
  samplesRef.current = samples;
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!hrActive) return;
    const id = setInterval(async () => {
      if (fetchingRef.current) return;
      const s = samplesRef.current;
      if (s.length < MIN_SAMPLES_FOR_AI) return;
      fetchingRef.current = true;
      try {
        const params = buildFeedbackParams(s, locale);
        const msg = await getHRFeedback(params);
        enqueueMessage({ text: msg, kind: 'cardiac' });
      } catch {
        // El canal cardíaco es complementario: fallar es silencioso.
      } finally {
        fetchingRef.current = false;
      }
    }, CARDIAC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hrActive, locale, enqueueMessage]);

  const heartScale = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));
  const bpmForBeat = currentBpm ? Math.round(currentBpm / 5) * 5 : null;
  useEffect(() => {
    if (!currentBpm) return;
    const ms = Math.max(60_000 / currentBpm, 300);
    const id = setInterval(() => {
      heartScale.value = withSequence(
        withTiming(1.28, { duration: 90 }),
        withTiming(1, { duration: 220 }),
      );
    }, ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpmForBeat]);

  // "Simular pánico" sin reloj: enciende el feed mock y dispara la curva al activarse.
  const pendingPanicRef = useRef(false);
  useEffect(() => {
    if (hrStatus === 'active' && pendingPanicRef.current) {
      pendingPanicRef.current = false;
      triggerPanic();
    }
  }, [hrStatus, triggerPanic]);

  function onSimulate() {
    if (hrSource === 'off') {
      pendingPanicRef.current = true;
      setHrSource('mock');
    } else {
      triggerPanic();
    }
  }
  function onConnectWatch() {
    router.push('/dispositivos');
  }

  // Si hay un reloj (Health Connect) o banda BLE conectados en Dispositivos,
  // crisis los usa directo. Se re-evalúa al volver (useFocusEffect).
  useFocusEffect(
    useCallback(() => {
      if (!isPremium) return;
      let active = true;
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user?.id) return;
          const { data } = await supabase
            .from('devices')
            .select('name, model, type')
            .eq('user_id', session.user.id)
            .eq('is_connected', true)
            .in('type', ['heart_rate_monitor', 'smartwatch'])
            .order('last_seen_at', { ascending: false });
          if (!active || !data || data.length === 0) return;

          const devices: CrisisDevice[] = data.map((d) =>
            d.type === 'heart_rate_monitor'
              ? { name: d.name as string, source: 'bluetooth', deviceId: d.model as string }
              : { name: d.name as string, source: 'healthConnect', deviceId: null },
          );
          setHrDevices(devices);
          setActiveIdx(0);
          setHrSource((s) => (s === 'mock' ? s : devices[0].source)); // no pisar una simulación en curso
        } catch {
          // sin conexión / sin sesión: crisis sigue sin monitoreo
        }
      })();
      return () => { active = false; };
    }, [isPremium]),
  );

  function dial(number: string) {
    Linking.openURL(`tel:${number}`).catch(() => {});
  }

  function close() {
    stopVoice();
    finalizeEpisode();
    router.back();
  }

  let card: { dial: string; name: string; desc: string } | null = null;
  if (message?.referral && isEmergencyLineCode(message.referral)) {
    card = {
      dial: EMERGENCY_LINES[message.referral].dial,
      name: t(`line${message.referral}Name` as TranslationKey),
      desc: t(`line${message.referral}Desc` as TranslationKey),
    };
  } else if (message?.referral === 'contact' && message.contact?.phone) {
    card = {
      dial: message.contact.phone,
      name: message.contact.name || t('crisisContactFallbackName'),
      desc: t('crisisContactDesc'),
    };
  }

  const isContact = message?.referral === 'contact' && !!message?.contact?.phone;
  const contactPhone = message?.contact?.phone ?? '';
  const profileContactPhone = profile?.emergency_contact_phone ?? '';
  const profileContactName = profile?.emergency_contact_name ?? '';

  async function alertContact(via: 'whatsapp' | 'sms', phone: string) {
    if (!phone) return;
    const mapsUrl = await getLocationMapsLink();
    const msg = buildAlertMessage({ name: profile?.display_name, mapsUrl, locale });
    if (via === 'whatsapp') await sendWhatsApp(phone, msg);
    else await sendSMS(phone, msg);
  }

  const watchConnected = hrSource === 'bluetooth' || hrSource === 'healthConnect';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <X size={24} color={colors.textMuted} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('crisisTitle')}</Text>
        <TouchableOpacity
          onPress={() => setEmergencyOpen(true)}
          style={[styles.callBtn, { backgroundColor: colors.danger }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Phone size={16} color="#fff" />
          <Text style={[styles.callBtnText, { color: '#fff' }]}>{t('crisisEmergency')}</Text>
        </TouchableOpacity>
      </View>

      {/* Menú superior (solo Plus): oculto cuando ya hay un dispositivo real dando BPM */}
      {isPremium && !watchConnected && (
        <View style={styles.toolbar}>
          <TouchableOpacity
            onPress={onConnectWatch}
            style={[styles.toolBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            activeOpacity={0.75}
          >
            <Wifi size={15} color={colors.textMuted} />
            <Text style={[styles.toolBtnText, { color: colors.textMuted }]}>
              {t('crisisConnectWatch')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onSimulate}
            style={[styles.toolBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            activeOpacity={0.75}
          >
            <Zap size={15} color={colors.danger} />
            <Text style={[styles.toolBtnText, { color: colors.textMuted }]}>
              {t('monitorSimulatePanic')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {hrActive && (
        <View style={styles.bpmSection}>
          <Animated.View style={heartStyle}>
            <Heart size={40} color={color} fill={color} />
          </Animated.View>
          <View style={styles.bpmRow}>
            <Text style={[styles.bpmNumber, { color }]}>{currentBpm ?? '--'}</Text>
            <Text style={[styles.bpmUnit, { color: colors.textMuted }]}>BPM</Text>
          </View>
          <View style={[styles.zonePill, { backgroundColor: color + '22' }]}>
            <Text style={[styles.zoneText, { color }]}>{zoneLabel()}</Text>
          </View>
          {watchConnected && hrStatus !== 'idle' && (
            <View style={styles.deviceRow}>
              <Wifi size={12} color={colors.primary} />
              <Text style={[styles.deviceText, { color: colors.textSecondary }]}>
                {t('monitorConnectedTo')}{' '}
                <Text style={{ fontWeight: '700', color: colors.text }}>
                  {activeDeviceName ?? t('monitorDeviceGeneric')}
                </Text>
              </Text>
            </View>
          )}

          {watchConnected && hrDevices.length > 1 && (
            <View style={styles.deviceSwitch}>
              {hrDevices.map((d, i) => {
                const isActive = i === activeIdx;
                return (
                  <TouchableOpacity
                    key={`${d.source}-${d.deviceId ?? 'hc'}-${i}`}
                    onPress={() => { setActiveIdx(i); setHrSource(d.source); }}
                    style={[
                      styles.deviceChip,
                      {
                        backgroundColor: isActive ? colors.primary : colors.surface,
                        borderColor: isActive ? colors.primary : colors.border,
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.deviceChipText, { color: isActive ? colors.primaryText : colors.textSecondary }]}>
                      {d.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      <View style={styles.strip}>
        {micDenied ? (
          <View style={styles.micDeniedBox}>
            <Text style={[styles.stripText, { color: colors.textSecondary }]}>
              {t('crisisMicNeeded')}
            </Text>
            <TouchableOpacity
              onPress={startVoice}
              style={[styles.enableVoiceBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.85}
            >
              <Mic size={18} color={colors.primaryText} />
              <Text style={[styles.enableVoiceText, { color: colors.primaryText }]}>
                {t('crisisEnableVoice')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {message && (
              <View style={styles.messageBox}>
                <View style={[
                  styles.msgIcon,
                  { backgroundColor: (message.kind === 'cardiac' ? colors.danger : colors.primary) + '1a' },
                ]}>
                  {message.kind === 'cardiac'
                    ? <Heart size={28} color={colors.danger} fill={colors.danger} />
                    : <Bot size={28} color={colors.primary} />}
                </View>
                <Text style={[styles.stripText, { color: colors.text }]}>{message.text}</Text>
              </View>
            )}

            {card && (
              <View style={styles.referralWrap}>
                <TouchableOpacity
                  onPress={() => dial(card!.dial)}
                  activeOpacity={0.85}
                  style={[styles.referralCard, { backgroundColor: colors.danger, shadowColor: colors.danger }]}
                >
                  <View style={styles.referralIcon}>
                    <Phone size={20} color={colors.danger} />
                  </View>
                  <View style={styles.referralBody}>
                    <Text style={styles.referralName}>{card.name}</Text>
                    <Text style={styles.referralDesc}>{card.desc}</Text>
                  </View>
                  <Text style={styles.referralCta}>{t('callNow')}</Text>
                </TouchableOpacity>

                {/* Contacto de confianza: avisar por WhatsApp/SMS con ubicación */}
                {isContact && (
                  <View style={styles.contactActions}>
                    <TouchableOpacity
                      onPress={() => alertContact('whatsapp', contactPhone)}
                      style={[styles.contactBtn, { backgroundColor: '#25D366' }]}
                      activeOpacity={0.85}
                    >
                      <MessageCircle size={18} color="#fff" />
                      <Text style={styles.contactBtnText}>WhatsApp</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => alertContact('sms', contactPhone)}
                      style={[styles.contactBtn, { backgroundColor: colors.primary }]}
                      activeOpacity={0.85}
                    >
                      <MessageSquare size={18} color={colors.primaryText} />
                      <Text style={[styles.contactBtnText, { color: colors.primaryText }]}>SMS</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16, borderTopColor: colors.border }]}>
        {!micDenied && (
          <View style={styles.voiceRow}>
            <View style={[
              styles.voiceOrb,
              {
                backgroundColor: voiceStatus === 'listening' ? colors.primary : colors.surfaceElevated,
                borderColor: colors.primary,
              },
            ]}>
              {voiceStatus === 'listening'
                ? <Mic size={20} color={colors.primaryText} />
                : <ActivityIndicator size="small" color={colors.primary} />}
            </View>
            <Text style={[styles.voiceStatusText, { color: colors.textSecondary }]}>
              {t(`voice_${voiceStatus}` as TranslationKey)}
            </Text>
          </View>
        )}

        {!micDenied && (
          <View style={styles.bottomActions}>
            <TouchableOpacity
              onPress={() => openBreathing('478')}
              style={[styles.breatheBtn, { borderColor: colors.border }]}
              activeOpacity={0.8}
            >
              <Wind size={17} color={colors.primary} />
              <Text style={[styles.breatheBtnText, { color: colors.textSecondary }]}>
                {t('breatheStart')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setConfirmEnd(true)}
              style={[styles.feelBetterBtn, { flex: 1, backgroundColor: colors.primary }]}
              activeOpacity={0.85}
            >
              <Heart size={18} color={colors.primaryText} fill={colors.primaryText} />
              <Text style={[styles.feelBetterText, { color: colors.primaryText }]}>
                {t('crisisFeelBetter')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <BreathingGuide visible={showBreathing} pattern={breathingPattern} onClose={closeBreathing} />

      <Modal visible={emergencyOpen} transparent animationType="fade" onRequestClose={() => setEmergencyOpen(false)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setEmergencyOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated, paddingBottom: insets.bottom + 16 }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('crisisEmergencyTitle')}</Text>

            <TouchableOpacity
              style={[styles.sheetAction, { backgroundColor: colors.danger }]}
              onPress={() => { setEmergencyOpen(false); dial(LINEA_113); }}
              activeOpacity={0.85}
            >
              <Phone size={18} color="#fff" />
              <Text style={styles.sheetActionText}>{t('crisisCall113')}</Text>
            </TouchableOpacity>

            {profileContactPhone ? (
              <>
                <TouchableOpacity
                  style={[styles.sheetAction, { backgroundColor: colors.primary }]}
                  onPress={() => { setEmergencyOpen(false); dial(profileContactPhone); }}
                  activeOpacity={0.85}
                >
                  <Phone size={18} color={colors.primaryText} />
                  <Text style={[styles.sheetActionText, { color: colors.primaryText }]}>
                    {locale === 'en-US' ? 'Call' : 'Llamar a'} {profileContactName || t('crisisContactFallbackName')}
                  </Text>
                </TouchableOpacity>
                <View style={styles.sheetRow}>
                  <TouchableOpacity
                    style={[styles.sheetActionHalf, { backgroundColor: '#25D366' }]}
                    onPress={() => { setEmergencyOpen(false); alertContact('whatsapp', profileContactPhone); }}
                    activeOpacity={0.85}
                  >
                    <MessageCircle size={18} color="#fff" />
                    <Text style={styles.sheetActionText}>WhatsApp</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sheetActionHalf, { backgroundColor: colors.surface }]}
                    onPress={() => { setEmergencyOpen(false); alertContact('sms', profileContactPhone); }}
                    activeOpacity={0.85}
                  >
                    <MessageSquare size={18} color={colors.text} />
                    <Text style={[styles.sheetActionText, { color: colors.text }]}>SMS</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <Text style={[styles.sheetHint, { color: colors.textMuted }]}>{t('crisisNoContact')}</Text>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <ConfirmModal
        visible={!!rateLimited}
        title={t('crisisLimitTitle')}
        message={t('crisisLimitMessage').replace('{limit}', String(rateLimited?.limit ?? 5))}
        confirmText={t('ok')}
        onConfirm={() => { setRateLimited(null); router.back(); }}
        onCancel={() => { setRateLimited(null); router.back(); }}
      />

      <ConfirmModal
        visible={confirmEnd}
        title={t('crisisEndTitle')}
        message={t('crisisEndMessage')}
        confirmText={t('crisisEndConfirm')}
        cancelText={t('cancel')}
        onConfirm={doFinish}
        onCancel={() => setConfirmEnd(false)}
      />

      {finishing && (
        <View style={[styles.resultOverlay, { backgroundColor: colors.background }]}>
          <View style={styles.resultLoading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.resultLoadingText, { color: colors.textSecondary }]}>
              {t('crisisGenerating')}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  callBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
  },
  callBtnText: { fontSize: 14, fontWeight: '800' },

  toolbar: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingTop: 12,
  },
  toolBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
  },
  toolBtnText: { fontSize: 13, fontWeight: '600' },

  bpmSection: { alignItems: 'center', paddingTop: 32, gap: 6 },
  bpmRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  bpmNumber: { fontSize: 60, fontWeight: '800', lineHeight: 66 },
  bpmUnit: { fontSize: 18, fontWeight: '600', paddingBottom: 8 },
  zonePill: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 999 },
  zoneText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  deviceText: { fontSize: 12 },
  deviceSwitch: { flexDirection: 'row', gap: 8, marginTop: 8 },
  deviceChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
  },
  deviceChipText: { fontSize: 12, fontWeight: '600' },

  strip: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 28, gap: 16,
  },
  messageBox: { alignItems: 'center', gap: 14 },
  msgIcon: {
    width: 52, height: 52, borderRadius: 26,
    justifyContent: 'center', alignItems: 'center',
  },
  stripText: { fontSize: 23, lineHeight: 32, fontWeight: '500', textAlign: 'center' },

  micDeniedBox: { alignItems: 'center', gap: 18 },
  enableVoiceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999,
  },
  enableVoiceText: { fontSize: 15, fontWeight: '700' },

  referralWrap: { alignSelf: 'stretch', gap: 8, marginTop: 4 },
  referralCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, padding: 14, alignSelf: 'stretch',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 5,
  },
  contactActions: { flexDirection: 'row', gap: 8 },
  contactBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 12,
  },
  contactBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  sheetAction: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 14, borderRadius: 14,
  },
  sheetRow: { flexDirection: 'row', gap: 12 },
  sheetActionHalf: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14,
  },
  sheetActionText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sheetHint: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingVertical: 8 },

  resultOverlay: { ...StyleSheet.absoluteFillObject, paddingHorizontal: 28 },
  resultLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  resultLoadingText: { fontSize: 16, fontWeight: '600' },
  referralIcon: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#ffffff',
    justifyContent: 'center', alignItems: 'center',
  },
  referralBody: { flex: 1 },
  referralName: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  referralDesc: { color: '#ffffff', fontSize: 12, opacity: 0.9, marginTop: 2, lineHeight: 16 },
  referralCta: { color: '#ffffff', fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },

  bottomBar: {
    alignItems: 'center', gap: 14,
    paddingTop: 14, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth,
  },
  voiceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  voiceOrb: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
  },
  voiceStatusText: { fontSize: 15, fontWeight: '600' },
  feelBetterBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    alignSelf: 'stretch', paddingVertical: 14, borderRadius: 14,
  },
  feelBetterText: { fontSize: 16, fontWeight: '700' },
  bottomActions: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  breatheBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 14, borderRadius: 14, borderWidth: 1,
  },
  breatheBtnText: { fontSize: 13, fontWeight: '600' },
});
