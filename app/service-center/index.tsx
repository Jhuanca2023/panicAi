import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, PhoneCall } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useProfile } from '../../hooks/useProfile';
import { useSnackbar } from '../../hooks/useSnackbar';
import { useTranslation } from '../../hooks/useTranslation';

export default function ServiceCenterScreen() {
  const { colors } = useTheme();
  const { profile, loading, updateProfile } = useProfile();
  const { show: showSnackbar } = useSnackbar();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { t, locale } = useTranslation();
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactName, setContactName] = useState(profile?.emergency_contact_name ?? '');
  const [contactPhone, setContactPhone] = useState(profile?.emergency_contact_phone ?? '');

  async function saveContact() {
    const name = contactName.trim();
    const phone = contactPhone.trim();
    setContactModalOpen(false);
    await updateProfile({
      emergency_contact_name: name || null,
      emergency_contact_phone: phone || null,
    });
    showSnackbar({ type: 'success', message: locale === 'en-US' ? 'Contact saved.' : 'Contacto guardado.' });
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
        <Text style={[styles.title, { color: colors.primary }]}>{t('emergencyContact')}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <PhoneCall size={20} color={colors.textMuted} />
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('emergencyContact')}</Text>
          <TouchableOpacity onPress={() => setContactModalOpen(true)}>
            <Text style={[styles.editLink, { color: colors.primary }]}>{t('edit')}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.contactCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {profile?.emergency_contact_name ? (
            <View>
              <Text style={[styles.contactName, { color: colors.text }]}>{profile.emergency_contact_name}</Text>
              <Text style={[styles.contactPhone, { color: colors.textMuted }]}>{profile.emergency_contact_phone}</Text>
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('noContact')}</Text>
          )}
        </View>
      </View>

      <Modal visible={contactModalOpen} transparent animationType="fade" onRequestClose={() => setContactModalOpen(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('emergencyContact')}</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder={locale === 'en-US' ? "Contact name" : "Nombre del contacto"}
              placeholderTextColor={colors.textMuted}
              value={contactName}
              onChangeText={setContactName}
            />
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder={locale === 'en-US' ? "Phone (eg: 999111222)" : "Teléfono (ej: 999111222)"}
              placeholderTextColor={colors.textMuted}
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setContactModalOpen(false)} style={styles.modalBtn}>
                <Text style={{ color: colors.textMuted }}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveContact} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 30, gap: 15 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold' },
  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', flex: 1 },
  editLink: { fontSize: 14, fontWeight: 'bold' },
  contactCard: { padding: 16, borderRadius: 16, borderWidth: 1 },
  contactName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  contactPhone: { fontSize: 14 },
  emptyText: { fontSize: 14, fontStyle: 'italic' },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 24 },
  modalContent: { borderRadius: 24, padding: 24, gap: 16 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
});
