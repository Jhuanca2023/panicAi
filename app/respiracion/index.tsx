import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ChevronLeft, Wind, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { BreathingGuide, type BreathingPattern } from '../../components/BreathingGuide';

const EXERCISES: { key: BreathingPattern; name: { es: string; en: string }; desc: { es: string; en: string } }[] = [
  {
    key: '478',
    name: { es: 'Respiración 4-7-8', en: '4-7-8 Breathing' },
    desc: { es: 'Relajante: inhala 4, mantén 7, exhala 8. Ideal para calmar la ansiedad.', en: 'Calming: inhale 4, hold 7, exhale 8. Great for anxiety.' },
  },
  {
    key: 'box',
    name: { es: 'Respiración cuadrada', en: 'Box breathing' },
    desc: { es: 'Equilibra y enfoca: inhala 4, mantén 4, exhala 4, mantén 4.', en: 'Balance & focus: inhale 4, hold 4, exhale 4, hold 4.' },
  },
  {
    key: 'calm',
    name: { es: 'Respiración 4-6', en: '4-6 Breathing' },
    desc: { es: 'Simple y suave: inhala 4, exhala 6. La exhalación larga activa la calma.', en: 'Simple & gentle: inhale 4, exhale 6. The long exhale brings calm.' },
  },
];

export default function RespiracionScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const en = locale === 'en-US';
  const [pattern, setPattern] = useState<BreathingPattern | null>(null);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: insets.top + 20 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={28} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.primary }]}>{t('breatheStart')}</Text>
        </View>

        <View style={styles.content}>
          <Text style={[styles.intro, { color: colors.textSecondary }]}>{t('breatheChoose')}</Text>

          {EXERCISES.map((ex) => (
            <TouchableOpacity
              key={ex.key}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setPattern(ex.key)}
              activeOpacity={0.85}
            >
              <View style={[styles.cardIcon, { backgroundColor: colors.primary + '18' }]}>
                <Wind size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardName, { color: colors.text }]}>{en ? ex.name.en : ex.name.es}</Text>
                <Text style={[styles.cardDesc, { color: colors.textMuted }]}>{en ? ex.desc.en : ex.desc.es}</Text>
              </View>
              <ChevronRight size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <BreathingGuide
        visible={pattern !== null}
        pattern={pattern ?? '478'}
        onClose={() => setPattern(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingHorizontal: 24, marginBottom: 20 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold' },
  content: { paddingHorizontal: 24, gap: 14 },
  intro: { fontSize: 15, marginBottom: 4 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, borderWidth: 1, padding: 16,
  },
  cardIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  cardName: { fontSize: 16, fontWeight: '700' },
  cardDesc: { fontSize: 13, marginTop: 3, lineHeight: 18 },
});
