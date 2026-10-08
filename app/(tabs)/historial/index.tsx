import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ChevronRight, Heart, Activity } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { useTranslation } from '../../../hooks/useTranslation';
import { getEpisodes, type Episode, type EpisodeSeverity } from '../../../lib/episodes';

export default function HistorialScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { locale } = useTranslation();
  const router = useRouter();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);

  // Recarga al enfocar (p. ej. al volver de un episodio recién guardado).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const data = await getEpisodes();
        if (active) { setEpisodes(data); setLoading(false); }
      })();
      return () => { active = false; };
    }, []),
  );

  const getStatusColor = (severity: EpisodeSeverity) => {
    if (severity === 'severe') return colors.error;
    if (severity === 'moderate') return '#F59E0B';
    return colors.success;
  };

  const getStatusText = (severity: EpisodeSeverity) => {
    if (severity === 'severe') return locale === 'en-US' ? 'Severe' : 'Severo';
    if (severity === 'moderate') return locale === 'en-US' ? 'Moderate' : 'Moderado';
    return locale === 'en-US' ? 'Mild' : 'Leve';
  };

  function formatDuration(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} min${secs > 0 ? ` ${secs} s` : ''}`;
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoy, ' + date.toLocaleTimeString(locale === 'es-PE' ? 'es-PE' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ayer, ' + date.toLocaleTimeString(locale === 'es-PE' ? 'es-PE' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString(locale === 'es-PE' ? 'es-PE' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  const renderItem = ({ item }: { item: Episode }) => (
    <TouchableOpacity
      style={[styles.historyItem, { backgroundColor: colors.surface }]}
      onPress={() => router.push(`/historial/${item.id}`)}
    >
      <View style={styles.itemLeft}>
        <View style={[styles.iconContainer, { backgroundColor: getStatusColor(item.severity) + '20' }]}>
          <Heart size={20} color={getStatusColor(item.severity)} fill={getStatusColor(item.severity)} />
        </View>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemDate, { color: colors.text }]}>{formatDate(item.started_at)}</Text>
          <Text style={[styles.itemStatus, { color: getStatusColor(item.severity) }]}>
            {getStatusText(item.severity)} • {formatDuration(item.duration_sec)}
            {item.hr ? ` • Pico ${item.hr.max} BPM` : ''}
          </Text>
        </View>
      </View>
      <ChevronRight size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 20 }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Historial</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Registros de episodios y ritmo cardíaco
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : episodes.length === 0 ? (
        <View style={styles.empty}>
          <Activity size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {locale === 'en-US' ? 'No episodes yet' : 'Aún no tienes episodios'}
          </Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>
            {locale === 'en-US'
              ? 'Your panic episodes will appear here after each session.'
              : 'Tus episodios de pánico aparecerán aquí después de cada sesión.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={episodes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  listContent: {
    paddingBottom: 100,
  },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    gap: 2,
    flex: 1,
  },
  itemDate: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemStatus: {
    fontSize: 14,
  },
});
