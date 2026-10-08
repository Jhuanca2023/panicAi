import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, useWindowDimensions,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import Svg, { Path, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Activity, Heart, Zap, Wifi, WifiOff, Bot, Square } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useProfile } from '../../hooks/useProfile';
import { supabase } from '../../lib/supabase';
import { t } from '../../lib/translations';
import { useHeartRate, setSelectedBluetoothDevice, type HeartRateSource } from '../../hooks/useHeartRate';
import type { HeartRateSample } from '../../lib/heartRate/types';
import { getHRFeedback, buildFeedbackParams } from '../../lib/hrFeedback';

const CHART_H         = 100;
const BPM_MIN         = 45;
const BPM_MAX         = 190;
const AI_INTERVAL_MS  = 30_000;
const MIN_SAMPLES_FOR_AI = 3;

function zoneColor(bpm: number | null, danger: string): string {
  if (bpm === null) return '#94a3b8';
  if (bpm < 100)   return '#22C55E';
  if (bpm < 130)   return '#F59E0B';
  return danger;
}

function HRChart({
  samples, color, width,
}: {
  samples: Pick<HeartRateSample, 'bpm'>[];
  color: string;
  width: number;
}) {
  if (samples.length < 2 || width <= 0) return null;

  const n   = samples.length;
  const pts = samples.map((s, i) => ({
    x: (i / (n - 1)) * width,
    y: CHART_H - (
      (Math.min(Math.max(s.bpm, BPM_MIN), BPM_MAX) - BPM_MIN) /
      (BPM_MAX - BPM_MIN)
    ) * CHART_H,
  }));

  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L ${pts[n-1].x.toFixed(1)},${CHART_H} L 0,${CHART_H} Z`;

  const y100 = CHART_H - ((100 - BPM_MIN) / (BPM_MAX - BPM_MIN)) * CHART_H;
  const y130 = CHART_H - ((130 - BPM_MIN) / (BPM_MAX - BPM_MIN)) * CHART_H;

  return (
    <Svg width={width} height={CHART_H}>
      <Defs>
        <LinearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.3" />
          <Stop offset="1" stopColor={color} stopOpacity="0"   />
        </LinearGradient>
      </Defs>
      <Line x1={0} y1={y100} x2={width} y2={y100}
        stroke="#F59E0B" strokeWidth={0.8} strokeDasharray="4 4" />
      <Line x1={0} y1={y130} x2={width} y2={y130}
        stroke="#EF4444" strokeWidth={0.8} strokeDasharray="4 4" />
      <Path d={areaPath} fill="url(#hrGrad)" />
      <Path d={linePath} fill="none" stroke={color}
        strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function MonitorScreen() {
  const { profile }   = useProfile();
  const locale        = profile?.locale || 'es-PE';
  const { colors }     = useTheme();
  const insets         = useSafeAreaInsets();
  const { width }      = useWindowDimensions();
  const cardInner      = width - 64;

  const [source, setSource] = useState<HeartRateSource>('off');
  // Si hay banda BLE detectada en Dispositivos, la fuente real es bluetooth; si no, Health Connect.
  const [bleName, setBleName]         = useState<string | null>(null);
  const [bleDeviceId, setBleDeviceId] = useState<string | null>(null);
  const realSource: HeartRateSource = bleDeviceId ? 'bluetooth' : 'healthConnect';
  const { samples, status, currentBpm, device, triggerPanic } = useHeartRate(source, bleDeviceId);

  const color  = zoneColor(currentBpm, colors.danger);
  const isMock = source === 'mock';
  const deviceName = source === 'bluetooth' ? bleName : device?.name ?? null;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user?.id) return;
          const { data } = await supabase
            .from('devices')
            .select('name, model')
            .eq('user_id', session.user.id)
            .eq('is_connected', true)
            .eq('type', 'heart_rate_monitor')
            .order('last_seen_at', { ascending: false })
            .limit(1);
          if (active && data && data.length > 0) {
            setBleName(data[0].name as string);
            setBleDeviceId(data[0].model as string);
            setSelectedBluetoothDevice(data[0].model as string);
          }
        } catch {
          // sin sesión/conexión: se mantiene el modo demo/health-connect
        }
      })();
      return () => { active = false; };
    }, []),
  );

  function zoneLabel() {
    if (!currentBpm)        return t('monitorZoneUnknown', locale);
    if (currentBpm < 60)    return t('monitorZoneLow', locale);
    if (currentBpm < 100)   return t('monitorZoneNormal', locale);
    if (currentBpm < 130)   return t('monitorZoneElevated', locale);
    return t('monitorZoneCrisis', locale);
  }

  const heartScale = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const bpmForBeat = currentBpm ? Math.round(currentBpm / 5) * 5 : null;
  useEffect(() => {
    if (!currentBpm) return;
    const ms = Math.max(60_000 / currentBpm, 300);
    const id = setInterval(() => {
      heartScale.value = withSequence(
        withTiming(1.28, { duration: 90 }),
        withTiming(1,    { duration: 220 }),
      );
    }, ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpmForBeat]);

  const [aiMessage,   setAiMessage]   = useState<string | null>(null);
  const [aiFetching,  setAiFetching]  = useState(false);
  const [aiError,     setAiError]     = useState(false);

  const barProgress = useSharedValue(0);
  const barStyle    = useAnimatedStyle(() => ({
    width: `${barProgress.value * 100}%` as unknown as number,
  }));

  const samplesRef    = useRef<HeartRateSample[]>([]);
  const fetchingRef   = useRef(false);
  const localeRef     = useRef(locale);
  samplesRef.current  = samples;
  localeRef.current   = locale;

  useEffect(() => {
    if (aiMessage === null) return;
    barProgress.value = 0;
    barProgress.value = withTiming(1, { duration: AI_INTERVAL_MS, easing: Easing.linear });
  }, [aiMessage]);

  // Solo mientras el monitor está enfocado: las tabs no se desmontan, así que con
  // useEffect el intervalo seguiría corriendo en background y gastando dinero.
  useFocusEffect(
    useCallback(() => {
      const fetchFeedback = async () => {
        if (fetchingRef.current) return;
        const s = samplesRef.current;
        if (s.length < MIN_SAMPLES_FOR_AI) return;

        fetchingRef.current = true;
        setAiFetching(true);
        setAiError(false);

        try {
          const params  = buildFeedbackParams(s, localeRef.current);
          const message = await getHRFeedback(params);
          setAiMessage(message);
        } catch {
          setAiError(true);
        } finally {
          fetchingRef.current = false;
          setAiFetching(false);
        }
      };

      const id = setInterval(fetchFeedback, AI_INTERVAL_MS);
      return () => clearInterval(id);
    }, []),
  );

  function statusLabel() {
    if (isMock) return t('monitorDemo', locale);
    switch (status) {
      case 'connecting':  return t('monitorStatusConnecting', locale);
      case 'active':      return t('monitorStatusActive', locale);
      case 'unavailable': return t('monitorStatusUnavailable', locale);
      default:            return t('monitorStatusIdle', locale);
    }
  }
  const badgeColor = isMock
    ? '#6366F1'
    : status === 'active' ? color : colors.textMuted;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t('monitorTitle', locale)}</Text>
        {source !== 'off' && (
          <View style={[styles.badge, { backgroundColor: badgeColor + '22' }]}>
            {isMock
              ? <Activity size={12} color={badgeColor} />
              : status === 'active'
                ? <Wifi    size={12} color={badgeColor} />
                : <WifiOff size={12} color={badgeColor} />
            }
            <Text style={[styles.badgeText, { color: badgeColor }]}>{statusLabel()}</Text>
          </View>
        )}
      </View>

      {source === 'off' ? (
        <View style={styles.chooser}>
          <Heart size={56} color={colors.primary} fill={colors.primary} />
          <Text style={[styles.chooserPrompt, { color: colors.text }]}>
            {t('monitorChoosePrompt', locale)}
          </Text>

          <TouchableOpacity
            style={[styles.optionCard, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
            onPress={() => setSource('mock')}
            activeOpacity={0.85}
          >
            <Activity size={22} color="#6366F1" />
            <View style={styles.optionTextWrap}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{t('monitorStartDemo', locale)}</Text>
              <Text style={[styles.optionDesc, { color: colors.textMuted }]}>{t('monitorStartDemoDesc', locale)}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionCard, { borderColor: colors.primary, backgroundColor: colors.primary + '12' }]}
            onPress={() => setSource(realSource)}
            activeOpacity={0.85}
          >
            <Wifi size={22} color={colors.primary} />
            <View style={styles.optionTextWrap}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{t('monitorStartLive', locale)}</Text>
              <Text style={[styles.optionDesc, { color: colors.textMuted }]}>
                {bleDeviceId ? (bleName ?? 'Banda BLE') : t('monitorLiveHealthConnect', locale)}
              </Text>
            </View>
          </TouchableOpacity>

          {!bleDeviceId && (
            <Text style={[styles.chooserHint, { color: colors.textMuted }]}>{t('monitorNoDevice', locale)}</Text>
          )}
        </View>
      ) : (
      <>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.bpmSection}>
          <Animated.View style={heartStyle}>
            <Heart size={40} color={color} fill={color} />
          </Animated.View>
          <View style={styles.bpmRow}>
            <Text style={[styles.bpmNumber, { color }]}>
              {currentBpm ?? '--'}
            </Text>
            <Text style={[styles.bpmUnit, { color: colors.textMuted }]}>BPM</Text>
          </View>
          <View style={[styles.zonePill, { backgroundColor: color + '22' }]}>
            <Text style={[styles.zoneText, { color }]}>{zoneLabel()}</Text>
          </View>

          {!isMock && status !== 'idle' && (
            <View style={styles.deviceRow}>
              <Wifi size={13} color={colors.primary} />
              <Text style={[styles.deviceText, { color: colors.textSecondary }]}>
                {t('monitorConnectedTo', locale)}{' '}
                <Text style={{ fontWeight: '700', color: colors.text }}>
                  {deviceName
                    ? (source === 'bluetooth' ? deviceName : `${t('monitorDeviceWord', locale)} ${deviceName}`)
                    : t('monitorDeviceGeneric', locale)}
                </Text>
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
              {t('monitorChartLabel', locale)}
            </Text>
            {samples.length > 0 && (
              <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
                {samples.length}s
              </Text>
            )}
          </View>

          {samples.length >= 2
            ? <HRChart samples={samples} color={color} width={cardInner} />
            : (
              <View style={styles.emptyRow}>
                <Activity size={18} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  {t('monitorChartWaiting', locale)}
                </Text>
              </View>
            )
          }

          <View style={styles.legend}>
            {([
              ['#22C55E', t('monitorLegendNormal', locale)],
              ['#F59E0B', t('monitorLegendElevated', locale)],
              [colors.danger, t('monitorLegendCrisis', locale)],
            ] as [string, string][]).map(([c, label]) => (
              <View key={c} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: c }]} />
                <Text style={[styles.legendLabel, { color: colors.textMuted }]}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.card, styles.aiCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.aiHeader}>
            <View style={styles.aiTitleRow}>
              <Bot size={16} color={colors.primary} />
              <Text style={[styles.aiTitle, { color: colors.text }]}>PanicAI</Text>
            </View>
            {aiFetching && <ActivityIndicator size="small" color={colors.textMuted} />}
          </View>

          <View style={styles.aiBody}>
            {!aiMessage && !aiFetching && !aiError && (
              <Text style={[styles.aiWaiting, { color: colors.textMuted }]}>
                {t('monitorAiWaiting', locale)}
              </Text>
            )}
            {aiError && !aiFetching && (
              <Text style={[styles.aiWaiting, { color: colors.textMuted }]}>
                {t('monitorAiError', locale)}
              </Text>
            )}
            {aiMessage && (
              <Text style={[styles.aiMessage, { color: colors.text }]}>{aiMessage}</Text>
            )}
          </View>

          {aiMessage && (
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <Animated.View
                style={[styles.progressBar, barStyle, { backgroundColor: colors.primary }]}
              />
            </View>
          )}
        </View>

        <View style={{ height: 12 }} />
      </ScrollView>

      {/* Espacio extra abajo: el tab bar flota y el botón de pánico se apoya en él. */}
      <View style={[
        styles.controls,
        { borderTopColor: colors.border, paddingBottom: insets.bottom + 120 },
      ]}>
        {isMock && (
          <TouchableOpacity
            onPress={triggerPanic}
            style={[styles.panicBtn, { backgroundColor: colors.danger }]}
            activeOpacity={0.82}
          >
            <Zap size={18} color={colors.dangerText} />
            <Text style={[styles.panicBtnText, { color: colors.dangerText }]}>
              {t('monitorSimulatePanic', locale)}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => setSource('off')}
          style={[styles.toggleBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          activeOpacity={0.75}
        >
          <Square size={14} color={colors.textMuted} fill={colors.textMuted} />
          <Text style={[styles.toggleBtnText, { color: colors.textMuted }]}>
            {t('monitorStop', locale)}
          </Text>
        </TouchableOpacity>
      </View>
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingBottom: 4,
  },
  title:      { fontSize: 28, fontWeight: 'bold' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  badgeText:  { fontSize: 12, fontWeight: '600' },

  scroll:     { paddingHorizontal: 16, paddingTop: 4 },

  chooser: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 16 },
  chooserPrompt: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  optionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, alignSelf: 'stretch',
    padding: 16, borderRadius: 16, borderWidth: 1.5,
  },
  optionTextWrap: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 16, fontWeight: '700' },
  optionDesc: { fontSize: 13, lineHeight: 18 },
  chooserHint: { fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 17 },

  bpmSection: { alignItems: 'center', paddingTop: 16, paddingBottom: 16, gap: 8 },
  bpmRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  bpmNumber:  { fontSize: 80, fontWeight: '800', lineHeight: 88 },
  bpmUnit:    { fontSize: 22, fontWeight: '600', paddingBottom: 10 },
  zonePill:   { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 999 },
  zoneText:   { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
  deviceRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  deviceText: { fontSize: 13 },

  card: {
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardLabel:  { fontSize: 12, fontWeight: '500' },
  emptyRow:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 20,
  },
  emptyText:  { fontSize: 13 },
  legend:     { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendLabel:{ fontSize: 11 },

  aiCard:      { gap: 0 },
  aiHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  aiTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiTitle:    { fontSize: 14, fontWeight: '700' },
  aiBody:     { minHeight: 52 },
  aiWaiting:  { fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  aiMessage:  { fontSize: 15, lineHeight: 22 },
  progressTrack: {
    height: 3, borderRadius: 2, marginTop: 12, overflow: 'hidden',
  },
  progressBar:   { height: 3, borderRadius: 2 },

  controls: {
    paddingHorizontal: 16, paddingTop: 10,
    gap: 8, borderTopWidth: StyleSheet.hairlineWidth,
  },
  panicBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: 14,
  },
  panicBtnText: { fontSize: 16, fontWeight: '700' },
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 11, borderRadius: 14, borderWidth: 1,
  },
  toggleBtnText: { fontSize: 14, fontWeight: '500' },
});
