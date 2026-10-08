import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronLeft, User, Activity, X, Pencil, Trash2
} from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useProfile } from '../../hooks/useProfile';
import { useSymptoms, resolveSymptomName } from '../../hooks/useSymptoms';
import { useSnackbar } from '../../hooks/useSnackbar';
import { useTranslation } from '../../hooks/useTranslation';
import { SymptomSelector } from '../../components/SymptomSelector';
import { ConfirmModal } from '../../components/ConfirmModal';
import { supabase } from '../../lib/supabase';

export default function ProfileDetailsScreen() {
  const { colors } = useTheme();
  const { profile, loading, uploadAvatar } = useProfile();
  const { userSymptoms, catalog, remove: removeSymptom } = useSymptoms();
  const { show: showSnackbar } = useSnackbar();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { t, locale } = useTranslation();
  const [symptomsModalOpen, setSymptomsModalOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAccount() {
    setDeleting(true);
    const { error } = await supabase.rpc('delete_user_account');
    if (error) {
      console.error('delete account error', error);
      setDeleting(false);
      setDeleteOpen(false);
      showSnackbar({ type: 'error', message: locale === 'en-US' ? "Couldn't delete the account." : 'No se pudo eliminar la cuenta.' });
      return;
    }
    // El gate de auth redirige a login al cerrar sesión.
    await supabase.auth.signOut();
  }

  if (loading || !profile) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const symptomChips = userSymptoms
    .map((us) => {
      if (us.custom_label) return { id: us.id, label: us.custom_label };
      const s = catalog.find((c) => c.id === us.symptom_id);
      return { id: us.id, label: s ? resolveSymptomName(s) : '' };
    })
    .filter((x) => x.label);

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert(locale === 'en-US' ? 'Permission needed.' : 'Necesitamos el permiso para continuar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    const url = await uploadAvatar(result.assets[0].uri);
    setUploadingAvatar(false);
    showSnackbar(
      url
        ? { type: 'success', message: locale === 'en-US' ? 'Profile photo updated.' : 'Foto de perfil actualizada.' }
        : { type: 'error', message: locale === 'en-US' ? 'Failed to update photo.' : 'No pudimos actualizar la foto.' },
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 40, paddingTop: insets.top + 20 }}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.primary }]}>{t('profile')}</Text>
      </View>

      <View style={styles.profileInfo}>
        <View style={styles.avatarContainer}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' }]}>
              <User size={40} color={colors.primary} />
            </View>
          )}
          <TouchableOpacity onPress={handlePickPhoto} style={[styles.changeBadge, { backgroundColor: '#7c96ff' }]}>
            <Text style={styles.changeText}>{t('change')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.nameRow}>
          <Text style={[styles.displayName, { color: colors.text }]}>
            {profile.display_name || 'Usuario'}
          </Text>
          <Pencil size={18} color={colors.textMuted} />
        </View>
      </View>

      <View style={styles.menuList}>
        <MenuOption label={t('membership')} onPress={() => router.push('/upgrade')} />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Activity size={20} color={colors.textMuted} />
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('mySymptoms')}</Text>
          <TouchableOpacity onPress={() => setSymptomsModalOpen(true)}>
            <Text style={[styles.editLink, { color: colors.primary }]}>{t('edit')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.chipsContainer}>
          {symptomChips.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('noSymptoms')}</Text>
          ) : (
            symptomChips.map((s) => (
              <View key={s.id} style={[styles.chip, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Text style={[styles.chipText, { color: colors.text }]}>{s.label}</Text>
                <TouchableOpacity onPress={() => removeSymptom(s.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={14} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.deleteBtn, { backgroundColor: colors.danger + '14' }]}
          onPress={() => setDeleteOpen(true)}
          activeOpacity={0.8}
        >
          <Trash2 size={20} color={colors.danger} />
          <Text style={[styles.deleteText, { color: colors.danger }]}>{t('deleteAccount')}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={symptomsModalOpen} animationType="slide" onRequestClose={() => setSymptomsModalOpen(false)}>
        <View style={[styles.modalRoot, { backgroundColor: colors.background, paddingTop: insets.top + 12 }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('mySymptoms')}</Text>
            <TouchableOpacity onPress={() => setSymptomsModalOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <SymptomSelector onDone={() => setSymptomsModalOpen(false)} />
          </ScrollView>
        </View>
      </Modal>

      <ConfirmModal
        visible={deleteOpen}
        title={locale === 'en-US' ? 'Delete your account?' : '¿Eliminar tu cuenta?'}
        message={locale === 'en-US'
          ? 'This is permanent. Your profile, symptoms and episode history will be deleted.'
          : 'Esta acción es permanente. Se borrarán tu perfil, síntomas e historial de episodios.'}
        confirmText={t('deleteAccount')}
        cancelText={t('cancel')}
        variant="destructive"
        loading={deleting}
        onConfirm={handleDeleteAccount}
        onCancel={() => setDeleteOpen(false)}
      />
    </ScrollView>
  );
}

function MenuOption({ label, onPress }: { label: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Text style={[styles.menuLabel, { color: colors.text }]}>{label}</Text>
      <ChevronLeft size={20} color={colors.textMuted} style={{ transform: [{ rotate: '180deg' }] }} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingHorizontal: 24, marginBottom: 20 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  profileInfo: { alignItems: 'center', marginBottom: 25 },
  avatarContainer: { position: 'relative', marginBottom: 15 },
  avatar: { width: 110, height: 110, borderRadius: 55 },
  changeBadge: { position: 'absolute', bottom: -5, alignSelf: 'center', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 12 },
  changeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  displayName: { fontSize: 24, fontWeight: 'bold' },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 20,
    marginBottom: 30,
    borderWidth: 1,
  },
  deviceIconContainer: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  deviceInfo: { flex: 1 },
  deviceTitle: { fontSize: 16, fontWeight: '600' },
  deviceSubtitle: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600' },
  menuList: { paddingHorizontal: 30, gap: 15, marginBottom: 30 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  menuLabel: { flex: 1, fontSize: 17, fontWeight: '500' },
  section: { paddingHorizontal: 30, marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', flex: 1 },
  editLink: { fontSize: 14, fontWeight: 'bold' },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 14 },
  emptyText: { fontSize: 14, fontStyle: 'italic' },
  footer: { marginTop: 10, paddingHorizontal: 24, paddingBottom: 40 },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 14, borderRadius: 14,
  },
  deleteText: { fontSize: 16, fontWeight: '700' },

  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '700' },
});
