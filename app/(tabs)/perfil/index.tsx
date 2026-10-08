import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronRight, User, Smartphone, Settings, Phone, LogOut, Pencil, Check, Crown, BookText, Headphones
} from 'lucide-react-native';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { useTheme } from '../../../hooks/useTheme';
import { useProfile } from '../../../hooks/useProfile';
import { useSnackbar } from '../../../hooks/useSnackbar';
import { useTranslation } from '../../../hooks/useTranslation';
import { ConfirmModal } from '../../../components/ConfirmModal';

export default function PerfilScreen() {
  const { colors } = useTheme();
  const { profile, loading, updateProfile } = useProfile();
  const { show: showSnackbar } = useSnackbar();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { t, locale } = useTranslation();
  const isPremium = profile?.plan === 'plus';
  const [nameEditing, setNameEditing] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [signOutOpen, setSignOutOpen] = useState(false);

  if (loading || !profile) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  function startNameEdit() {
    setNameValue(profile?.display_name ?? '');
    setNameEditing(true);
  }

  async function commitName() {
    const next = nameValue.trim();
    setNameEditing(false);
    if (next && next !== profile?.display_name) {
      await updateProfile({ display_name: next });
      showSnackbar({ type: 'success', message: locale === 'en-US' ? 'Name updated.' : 'Nombre actualizado.' });
    }
  }

  async function handleSignOut() {
    setSignOutOpen(false);
    await supabase.auth.signOut();
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 120, paddingTop: insets.top + 20 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>{t('settingsTitle')}</Text>
      </View>

      <View style={styles.optionsList}>
        <OptionItem
          icon={<User size={20} color={colors.text} />}
          label={t('profile')}
          onPress={() => router.push('/profile-details')}
        />
        <OptionItem
          icon={<Smartphone size={20} color={colors.text} />}
          label={t('devices')}
          premium={!isPremium}
          onPress={() => router.push(isPremium ? '/dispositivos' : '/upgrade')}
        />
        <OptionItem
          icon={<Settings size={20} color={colors.text} />}
          label={t('systemConfig')}
          onPress={() => router.push('/system-settings')}
        />
        <OptionItem
          icon={<Phone size={20} color={colors.text} />}
          label={t('emergencyContact')}
          onPress={() => router.push('/service-center')}
        />
        <OptionItem
          icon={<BookText size={20} color={colors.text} />}
          label={t('history')}
          onPress={() => router.push('/(tabs)/historial')}
        />
        <OptionItem
          icon={<Headphones size={20} color={colors.text} />}
          label={t('support')}
          onPress={() => router.push('/soporte')}
        />
        <OptionItem
          icon={<LogOut size={20} color={colors.danger} />}
          label={t('signOut')}
          danger
          onPress={() => setSignOutOpen(true)}
        />
      </View>

      <ConfirmModal
        visible={signOutOpen}
        onCancel={() => setSignOutOpen(false)}
        onConfirm={() => handleSignOut()}
        title={t('signOutTitle')}
        message={t('signOutMsg')}
        confirmText={t('signOutConfirm')}
        cancelText={t('cancel')}
        variant="destructive"
      />
    </ScrollView>
  );
}

function OptionItem({ icon, label, onPress, premium, danger }: { icon: any, label: string, onPress?: () => void, premium?: boolean, danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity style={styles.optionItem} onPress={onPress}>
      <View style={[styles.optionIconContainer, { backgroundColor: danger ? colors.danger + '1a' : colors.surfaceElevated }]}>
        {icon}
      </View>
      <Text style={[styles.optionLabel, { color: danger ? colors.danger : colors.text }]}>{label}</Text>
      {premium && <Crown size={16} color="#F59E0B" fill="#F59E0B" style={{ marginRight: 6 }} />}
      {!danger && <ChevronRight size={20} color={colors.textMuted} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pageHeader: { paddingHorizontal: 24, marginBottom: 24 },
  pageTitle: { fontSize: 28, fontWeight: 'bold' },
  optionsList: { paddingHorizontal: 35, gap: 15, marginBottom: 40 },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  optionLabel: { flex: 1, fontSize: 18, fontWeight: '500' },
  footer: { alignItems: 'center', marginTop: 20 },
  signOutBtn: { alignItems: 'center', gap: 15 },
  logoutIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signOutText: { fontSize: 18, fontWeight: 'bold' },
});
