import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ChevronLeft, Mail, GraduationCap, Users } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';

const SUPPORT_EMAIL = 'soporte.panicai@cibertec.edu.pe';

const TEAM = [
  'Marcano Abreu, Jesús Francisco',
  'Huanca Otiniano, José Armando',
  'Musante Cortez, Alexis',
  'García Gonzales, Anayeli Lizeth',
];

export default function SoporteScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const en = locale === 'en-US';

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
          <Text style={[styles.title, { color: colors.primary }]}>{t('support')}</Text>
        </View>

        <View style={styles.content}>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.cardHeader}>
              <Mail size={18} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {en ? 'Support contact' : 'Contacto de soporte'}
              </Text>
            </View>
            <Text style={[styles.cardText, { color: colors.textSecondary }]}>
              {en
                ? 'Got a question or issue? Write to us:'
                : '¿Tienes una consulta o problema? Escríbenos:'}
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
              style={[styles.emailBtn, { backgroundColor: colors.primary + '15' }]}
              activeOpacity={0.8}
            >
              <Mail size={16} color={colors.primary} />
              <Text style={[styles.emailText, { color: colors.primary }]}>{SUPPORT_EMAIL}</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.cardHeader}>
              <GraduationCap size={18} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {en ? 'About the project' : 'Sobre el proyecto'}
              </Text>
            </View>
            <Text style={[styles.cardText, { color: colors.textSecondary }]}>
              {en
                ? 'PanicAI is a thesis project developed at Cibertec, focused on personalized accompaniment during panic attacks in Lima, Peru.'
                : 'PanicAI es un proyecto de tesis desarrollado en Cibertec, enfocado en el acompañamiento personalizado durante ataques de pánico en Lima, Perú.'}
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.cardHeader}>
              <Users size={18} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {en ? 'Team' : 'Integrantes'}
              </Text>
            </View>
            {TEAM.map((name) => (
              <View key={name} style={styles.memberRow}>
                <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
                <Text style={[styles.memberName, { color: colors.text }]}>{name}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingHorizontal: 24, marginBottom: 20 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold' },
  content: { paddingHorizontal: 24, gap: 16 },

  card: { borderRadius: 16, padding: 16, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardText: { fontSize: 14, lineHeight: 21 },

  emailBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, alignSelf: 'flex-start',
  },
  emailText: { fontSize: 14, fontWeight: '600' },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3 },
  memberName: { fontSize: 14 },
});
