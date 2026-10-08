import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Dimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileText, Headphones, User, MapPin, ChevronRight, Wind } from 'lucide-react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';
import { useProfile } from '../../hooks/useProfile';
import { useTranslation } from '../../hooks/useTranslation';
import { getEpisodes, type Episode } from '../../lib/episodes';
import { getGreeting } from '../../lib/translations';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { colors } = useTheme();
  const { profile } = useProfile();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { t, locale } = useTranslation();
  const name = profile?.display_name?.split(' ')[0] || 'Usuario';
  const greeting = getGreeting(locale);
  const avatarUrl = profile?.avatar_url;

  // El Home solo muestra el historial de episodios; el BPM en vivo vive en Monitor y Modo Crisis.
  const [episodes, setEpisodes] = useState<Episode[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getEpisodes().then((eps) => { if (active) setEpisodes(eps); });
      return () => { active = false; };
    }, []),
  );

  const withHr = episodes.filter((e) => e.hr);
  const maxBpm = withHr.length ? Math.max(...withHr.map((e) => e.hr!.max)) : null;
  // Picos por episodio en orden cronológico; cada punto guarda su id para abrir el detalle.
  const peakPoints = withHr.map((e) => ({ id: e.id, value: e.hr!.max })).reverse();
  const lastPeak = withHr.length ? withHr[0].hr!.max : null;

  function statusValue() {
    if (!episodes.length) return t('calm');
    const sev = episodes[0].severity;
    if (sev === 'severe') return t('monitorZoneCrisis');
    if (sev === 'moderate') return t('monitorZoneElevated');
    return t('calm');
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 20 }]}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>{greeting}, {name}</Text>
            <Text style={styles.subGreeting}>{t('today')}</Text>
          </View>
          <Pressable 
            style={styles.avatarContainer} 
            onPress={() => router.push('/profile-details')}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surface }]}>
                <User size={24} color={colors.primary} />
              </View>
            )}
          </Pressable>
        </View>

        <View style={[styles.mainCard, { backgroundColor: colors.surface }]}>
          <View style={styles.mainCardHeader}>
            <View>
              <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>{t('heartRate')}</Text>
              <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>{t('homeHistoryHr')}</Text>
              <View style={styles.bpmContainer}>
                <Text style={[styles.bpmValue, { color: colors.primary }]}>{lastPeak ?? '--'}</Text>
                <Text style={[styles.bpmUnit, { color: colors.primary }]}>BPM</Text>
              </View>
            </View>
          </View>

          <View style={styles.chartContainer}>
            {peakPoints.length >= 2 ? (
              <HomeChart
                points={peakPoints}
                width={width - 80}
                color="#22d3ee"
                onPointPress={(id) => router.push(`/historial/${id}`)}
              />
            ) : (
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                {t('monitorChartWaiting')}
              </Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('homeHistorySummary')}</Text>
        <View style={styles.statsRow}>
          <StatCard label={t('episodes')} value={String(episodes.length)} />
          <StatCard label={t('maxBpm')} value={maxBpm ? String(maxBpm) : '--'} />
          <StatCard label={t('status')} value={statusValue()} isLast />
        </View>

        <View style={styles.actionsRow}>
          <ActionButton
            label={t('history')}
            icon={<FileText size={20} color={colors.primary} />}
            onPress={() => router.push('/(tabs)/historial')}
          />
          <ActionButton
            label={t('support')}
            icon={<Headphones size={20} color={colors.primary} />}
            onPress={() => router.push('/soporte')}
          />
        </View>

        <Pressable
          style={[styles.resourceCard, { backgroundColor: colors.surface }]}
          onPress={() => router.push('/respiracion')}
        >
          <View style={[styles.resourceIcon, { backgroundColor: colors.primary + '18' }]}>
            <Wind size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.resourceTitle, { color: colors.text }]}>{t('breatheStart')}</Text>
            <Text style={[styles.resourceSubtitle, { color: colors.textMuted }]}>{t('breatheCardDesc')}</Text>
          </View>
          <ChevronRight size={22} color={colors.textMuted} />
        </Pressable>

        <Pressable
          style={[styles.csmcCard, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/csmc-map')}
        >
          <View style={styles.csmcIcon}>
            <MapPin size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.csmcTitle}>{t('healthCenters')}</Text>
            <Text style={styles.csmcSubtitle}>{t('healthCentersDesc')}</Text>
          </View>
          <ChevronRight size={22} color="#fff" />
        </Pressable>
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value, isLast }: { label: string, value: string, isLast?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface }, isLast && { marginRight: 0 }]}>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.primary }]}>{value}</Text>
    </View>
  );
}

function ActionButton({ label, icon, onPress }: { label: string, icon: any, onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable style={[styles.actionBtn, { backgroundColor: colors.surface }]} onPress={onPress}>
      <View style={[styles.actionIconContainer, { backgroundColor: colors.surfaceElevated }]}>{icon}</View>
      <Text style={[styles.actionLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function HomeChart({
  points, width, color, onPointPress,
}: {
  points: { id: string; value: number }[];
  width: number;
  color: string;
  onPointPress: (id: string) => void;
}) {
  const H = 110;
  const PAD_X = 16;
  const PAD_TOP = 24;
  const PAD_BOTTOM = 14;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const innerW = width - PAD_X * 2;
  const usableH = H - PAD_TOP - PAD_BOTTOM;
  const xy = points.map((p, i) => ({
    id: p.id,
    value: p.value,
    x: PAD_X + (i / Math.max(1, points.length - 1)) * innerW,
    y: PAD_TOP + (1 - (p.value - min) / range) * usableH,
  }));
  const line = xy.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L ${xy[xy.length - 1].x.toFixed(1)},${H} L ${xy[0].x.toFixed(1)},${H} Z`;

  return (
    <View style={{ width, height: H }}>
      <Svg width={width} height={H}>
        <Defs>
          <LinearGradient id="homeHrGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.28" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#homeHrGrad)" />
        <Path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {xy.map((p) => (
          <React.Fragment key={p.id}>
            <SvgText x={p.x} y={p.y - 12} fontSize="11" fontWeight="700" fill={color} textAnchor="middle">
              {p.value}
            </SvgText>
            <Circle cx={p.x} cy={p.y} r={5} fill={color} stroke="#fff" strokeWidth={1.5} />
          </React.Fragment>
        ))}
      </Svg>
      {/* Overlays tappables: más confiables que onPress sobre el SVG */}
      {xy.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => onPointPress(p.id)}
          style={{ position: 'absolute', left: p.x - 20, top: p.y - 20, width: 40, height: 40, borderRadius: 20 }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 280,
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
    paddingHorizontal: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subGreeting: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatar: { width: '100%', height: '100%' },
  avatarPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  mainCard: {
    borderRadius: 30,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  mainCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: { fontSize: 14, fontWeight: '600' },
  cardSubtitle: { fontSize: 11, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  bpmContainer: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  bpmValue: { fontSize: 32, fontWeight: 'bold' },
  bpmUnit: { fontSize: 14, fontWeight: '600', marginLeft: 4 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  chartContainer: { height: 110, marginTop: 12, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 24, marginTop: 115 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    marginRight: 10,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  statLabel: { fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: 'bold' },
  actionsRow: { flexDirection: 'row', gap: 15, marginBottom: 25 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  actionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionLabel: { fontSize: 16, fontWeight: '600' },
  resourceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 20, padding: 18, marginBottom: 16,
  },
  resourceIcon: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  resourceTitle: { fontSize: 16, fontWeight: '700' },
  resourceSubtitle: { fontSize: 13, marginTop: 2, lineHeight: 17 },
  csmcCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },
  csmcIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  csmcTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  csmcSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2, lineHeight: 17 },
});
