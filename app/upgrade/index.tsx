import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ChevronLeft, Crown, Check, Infinity as InfinityIcon, Watch, Activity, BookText } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { useProfile } from '../../hooks/useProfile';
import { useSnackbar } from '../../hooks/useSnackbar';

export default function UpgradeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { locale } = useTranslation();
  const { profile, upgradeToPlus } = useProfile();
  const { show: showSnackbar } = useSnackbar();
  const en = locale === 'en-US';
  const isPlus = profile?.plan === 'plus';
  const [loading, setLoading] = useState(false);

  const benefits = [
    {
      icon: InfinityIcon,
      title: en ? 'Unlimited AI sessions' : 'Sesiones de IA ilimitadas',
      desc: en ? 'No more 5-sessions-per-month limit' : 'Sin el límite de 5 sesiones al mes',
    },
    {
      icon: Watch,
      title: en ? 'Wearable connection' : 'Conexión a wearables',
      desc: en ? 'Watch and BLE bands for live heart rate' : 'Reloj y bandas BLE para frecuencia cardíaca en vivo',
    },
    {
      icon: Activity,
      title: en ? 'Live heart monitor' : 'Monitor cardíaco en vivo',
      desc: en ? 'Track your BPM during a crisis and beyond' : 'Sigue tu BPM durante la crisis y en tu día a día',
    },
    {
      icon: BookText,
      title: en ? 'History with heart rate' : 'Historial con frecuencia cardíaca',
      desc: en ? 'Episode summaries enriched with your BPM' : 'Resúmenes de episodios enriquecidos con tu BPM',
    },
  ];

  async function handleUpgrade() {
    if (isPlus) return;
    setLoading(true);
    const ok = await upgradeToPlus();
    setLoading(false);
    if (ok) {
      showSnackbar({ type: 'success', message: en ? 'Welcome to Plus! 🎉' : '¡Bienvenido a Plus! 🎉' });
      router.back();
    } else {
      showSnackbar({ type: 'error', message: en ? "Couldn't upgrade. Try again." : 'No se pudo actualizar. Intenta de nuevo.' });
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32, paddingTop: insets.top + 8 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={28} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={[styles.crownCircle, { backgroundColor: '#F59E0B22' }]}>
            <Crown size={40} color="#F59E0B" fill="#F59E0B" />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {isPlus ? (en ? 'PanicAI Plus' : 'PanicAI Plus') : (en ? 'Go Plus' : 'Hazte Plus')}
          </Text>
          <View style={[styles.planBadge, { backgroundColor: (isPlus ? '#F59E0B' : colors.textMuted) + '1a' }]}>
            <Text style={[styles.planBadgeText, { color: isPlus ? '#F59E0B' : colors.textMuted }]}>
              {en ? 'Current plan: ' : 'Plan actual: '}{isPlus ? 'Plus' : 'Free'}
            </Text>
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {isPlus
              ? (en ? 'You have the full PanicAI experience.' : 'Tienes el acompañamiento completo de PanicAI.')
              : (en ? 'Free includes voice crisis mode, history, breathing and CSMC map. Plus adds:' : 'El plan Free incluye Modo Crisis por voz, historial, respiración y mapa CSMC. Con Plus sumas:')}
          </Text>

          <View style={styles.benefits}>
            {benefits.map((b, i) => {
              const Icon = b.icon;
              return (
                <View key={i} style={[styles.benefitCard, { backgroundColor: colors.surface }]}>
                  <View style={[styles.benefitIcon, { backgroundColor: colors.primary + '18' }]}>
                    <Icon size={22} color={colors.primary} />
                  </View>
                  <View style={styles.benefitText}>
                    <Text style={[styles.benefitTitle, { color: colors.text }]}>{b.title}</Text>
                    <Text style={[styles.benefitDesc, { color: colors.textMuted }]}>{b.desc}</Text>
                  </View>
                  <Check size={18} color={colors.success} strokeWidth={3} />
                </View>
              );
            })}
          </View>

          <View style={[styles.priceCard, { borderColor: colors.primary }]}>
            <Text style={[styles.planName, { color: colors.primary }]}>PanicAI Plus</Text>
            <Text style={[styles.price, { color: colors.text }]}>
              S/. 19.90 <Text style={[styles.priceUnit, { color: colors.textMuted }]}>{en ? '/ month' : '/ mes'}</Text>
            </Text>
            <Text style={[styles.payNote, { color: colors.textMuted }]}>
              {en ? 'Pay with Yape or Plin' : 'Pago con Yape o Plin'}
            </Text>
          </View>

          {isPlus ? (
            <View style={[styles.alreadyBadge, { backgroundColor: colors.success + '18' }]}>
              <Crown size={18} color={colors.success} fill={colors.success} />
              <Text style={[styles.alreadyText, { color: colors.success }]}>
                {en ? 'You are Plus' : 'Ya eres Plus'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.cta, { backgroundColor: colors.primary }]}
              onPress={handleUpgrade}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={colors.primaryText} />
                : (
                  <>
                    <Crown size={18} color={colors.primaryText} fill={colors.primaryText} />
                    <Text style={[styles.ctaText, { color: colors.primaryText }]}>
                      {en ? 'Upgrade to Plus' : 'Actualizar a Plus'}
                    </Text>
                  </>
                )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  content: { paddingHorizontal: 24, alignItems: 'center' },

  crownCircle: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center', marginTop: 8, marginBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '800' },
  planBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, marginTop: 8 },
  planBadgeText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  subtitle: { fontSize: 15, textAlign: 'center', marginTop: 10, lineHeight: 21, marginBottom: 24 },

  benefits: { alignSelf: 'stretch', gap: 12 },
  benefitCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14,
  },
  benefitIcon: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  benefitText: { flex: 1 },
  benefitTitle: { fontSize: 15, fontWeight: '700' },
  benefitDesc: { fontSize: 13, marginTop: 2, lineHeight: 17 },

  priceCard: {
    alignSelf: 'stretch', alignItems: 'center', borderWidth: 1.5, borderRadius: 16,
    paddingVertical: 18, marginTop: 24, gap: 4,
  },
  planName: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  price: { fontSize: 30, fontWeight: '800' },
  priceUnit: { fontSize: 15, fontWeight: '500' },
  payNote: { fontSize: 13 },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    alignSelf: 'stretch', paddingVertical: 16, borderRadius: 14, marginTop: 20,
  },
  ctaText: { fontSize: 16, fontWeight: '700' },

  alreadyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999, marginTop: 20,
  },
  alreadyText: { fontSize: 15, fontWeight: '700' },
});
