import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { ChevronLeft, Share2, Heart, Sparkles, Clock, Check, X, Phone, Activity } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { getEpisode, type Episode, type EpisodeSeverity, type EpisodeOutcome } from '../../lib/episodes';

export default function EpisodeDetailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { locale } = useTranslation();
  const router = useRouter();
  const { episodeId } = useLocalSearchParams<{ episodeId: string }>();
  const en = locale === 'en-US';

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const data = episodeId ? await getEpisode(episodeId) : null;
        if (active) { setEpisode(data); setLoading(false); }
      })();
      return () => { active = false; };
    }, [episodeId]),
  );

  function severityColor(s: EpisodeSeverity) {
    if (s === 'severe') return colors.error;
    if (s === 'moderate') return '#F59E0B';
    return colors.success;
  }
  function severityText(s: EpisodeSeverity) {
    if (s === 'severe') return en ? 'Severe' : 'Severo';
    if (s === 'moderate') return en ? 'Moderate' : 'Moderado';
    return en ? 'Mild' : 'Leve';
  }
  function outcomeText(o: EpisodeOutcome) {
    if (o === 'improved') return en ? 'Improved' : 'Mejoró';
    if (o === 'escalated') return en ? 'Escalated' : 'Escaló';
    return en ? 'No change' : 'Sin cambios';
  }
  function formatDuration(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} min${secs > 0 ? ` ${secs} s` : ''}`;
  }
  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString(en ? 'en-US' : 'es-PE', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  async function shareEpisode() {
    if (!episode) return;
    const lines = [
      `PanicAI — ${en ? 'Episode' : 'Episodio'} ${formatDate(episode.started_at)}`,
      `${en ? 'Severity' : 'Severidad'}: ${severityText(episode.severity)}`,
      `${en ? 'Duration' : 'Duración'}: ${formatDuration(episode.duration_sec)}`,
      `${en ? 'Outcome' : 'Resultado'}: ${outcomeText(episode.outcome)}`,
      episode.hr ? `BPM: ${episode.hr.avg} (min ${episode.hr.min} / max ${episode.hr.max})` : '',
      '',
      episode.summary,
    ].filter(Boolean);
    try { await Share.share({ message: lines.join('\n') }); } catch { /* cancelado */ }
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!episode) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: colors.textSecondary }}>{en ? 'Episode not found' : 'Episodio no encontrado'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>{en ? 'Go back' : 'Volver'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sevColor = severityColor(episode.severity);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: insets.top + 8 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={28} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.primary }]}>{en ? 'Episode' : 'Episodio'}</Text>
          <TouchableOpacity onPress={shareEpisode} style={styles.shareBtn}>
            <Share2 size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={[styles.date, { color: colors.textSecondary }]}>{formatDate(episode.started_at)}</Text>

          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
              <Clock size={18} color={colors.textSecondary} />
              <Text style={[styles.statValue, { color: colors.text }]}>{formatDuration(episode.duration_sec)}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{en ? 'Duration' : 'Duración'}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
              <Activity size={18} color={sevColor} />
              <Text style={[styles.statValue, { color: sevColor }]}>{severityText(episode.severity)}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{en ? 'Severity' : 'Severidad'}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
              <Heart size={18} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.text }]}>{outcomeText(episode.outcome)}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{en ? 'Outcome' : 'Resultado'}</Text>
            </View>
          </View>

          {episode.hr && (
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{en ? 'Heart rate' : 'Frecuencia cardíaca'}</Text>
              <View style={styles.hrRow}>
                <View style={styles.hrItem}>
                  <Text style={[styles.hrValue, { color: colors.success }]}>{episode.hr.min}</Text>
                  <Text style={[styles.hrLabel, { color: colors.textMuted }]}>{en ? 'Min' : 'Mín'}</Text>
                </View>
                <View style={styles.hrItem}>
                  <Text style={[styles.hrValue, { color: colors.text }]}>{episode.hr.avg}</Text>
                  <Text style={[styles.hrLabel, { color: colors.textMuted }]}>{en ? 'Avg' : 'Prom'}</Text>
                </View>
                <View style={styles.hrItem}>
                  <Text style={[styles.hrValue, { color: colors.error }]}>{episode.hr.max}</Text>
                  <Text style={[styles.hrLabel, { color: colors.textMuted }]}>{en ? 'Max' : 'Máx'}</Text>
                </View>
              </View>
            </View>
          )}

          {!!episode.summary && (
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.cardTitleRow}>
                <Sparkles size={16} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>{en ? 'AI summary' : 'Resumen de la IA'}</Text>
              </View>
              <Text style={[styles.summaryText, { color: colors.textSecondary }]}>{episode.summary}</Text>
            </View>
          )}

          {episode.symptoms.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{en ? 'Symptoms' : 'Síntomas'}</Text>
              <View style={styles.chips}>
                {episode.symptoms.map((s, i) => (
                  <View key={i} style={[styles.chip, { backgroundColor: colors.surfaceElevated }]}>
                    <Text style={[styles.chipText, { color: colors.textSecondary }]}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {episode.techniques.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{en ? 'Techniques' : 'Técnicas aplicadas'}</Text>
              {episode.techniques.map((tk, i) => (
                <View key={i} style={styles.techRow}>
                  <View style={[styles.techIcon, { backgroundColor: (tk.effective ? colors.success : colors.textMuted) + '22' }]}>
                    {tk.effective
                      ? <Check size={14} color={colors.success} strokeWidth={3} />
                      : <X size={14} color={colors.textMuted} strokeWidth={3} />}
                  </View>
                  <Text style={[styles.techName, { color: colors.text }]}>{tk.name}</Text>
                  <Text style={[styles.techTag, { color: tk.effective ? colors.success : colors.textMuted }]}>
                    {tk.effective ? (en ? 'Worked' : 'Funcionó') : (en ? "Didn't help" : 'No ayudó')}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {episode.referral && (
            <View style={[styles.card, { backgroundColor: colors.danger + '14' }]}>
              <View style={styles.cardTitleRow}>
                <Phone size={16} color={colors.danger} />
                <Text style={[styles.cardTitle, { color: colors.danger }]}>
                  {en ? 'Referral suggested' : 'Se sugirió derivación'}
                </Text>
              </View>
              <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                {en ? 'Line' : 'Línea'} {episode.referral}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, marginBottom: 8,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { flex: 1, fontSize: 24, fontWeight: 'bold' },
  shareBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  content: { paddingHorizontal: 24, gap: 16 },
  date: { fontSize: 14 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 14, borderRadius: 14 },
  statValue: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  statLabel: { fontSize: 11 },

  card: { borderRadius: 16, padding: 16, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryText: { fontSize: 14, lineHeight: 21 },

  hrRow: { flexDirection: 'row', justifyContent: 'space-around' },
  hrItem: { alignItems: 'center', gap: 2 },
  hrValue: { fontSize: 26, fontWeight: '800' },
  hrLabel: { fontSize: 12 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  chipText: { fontSize: 13 },

  techRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  techIcon: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  techName: { fontSize: 14, flex: 1 },
  techTag: { fontSize: 12, fontWeight: '600' },
});
