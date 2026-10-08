import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Check, Sun, Moon, Monitor, Languages, Volume2, Play } from 'lucide-react-native';
import * as Speech from 'expo-speech';
import { useTheme } from '../../hooks/useTheme';
import { useProfile } from '../../hooks/useProfile';
import { useTranslation } from '../../hooks/useTranslation';
import { useSpeechSettings } from '../../hooks/useSpeechSettings';

export default function SystemSettingsScreen() {
  const { colors, setMode, mode: themeMode } = useTheme();
  const { profile, updateProfile } = useProfile();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { t, locale } = useTranslation();
  const [langModalOpen, setLangModalOpen] = useState(false);

  const { ttsEnabled, voiceId, setTtsEnabled, setVoiceId } = useSpeechSettings();
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voices, setVoices] = useState<Speech.Voice[]>([]);

  const lang = locale.startsWith('en') ? 'en' : 'es';

  useEffect(() => {
    Speech.getAvailableVoicesAsync()
      .then((all) => setVoices(all.filter((v) => v.language?.toLowerCase().startsWith(lang))))
      .catch(() => setVoices([]));
  }, [lang]);

  const selectedVoiceName = voices.find((v) => v.identifier === voiceId)?.name ?? t('voiceDefault');

  function previewVoice(id: string | null) {
    Speech.stop();
    Speech.speak(t('voicePreviewSample'), {
      language: locale,
      voice: id ?? undefined,
      rate: 0.9,
    });
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
        <Text style={[styles.title, { color: colors.primary }]}>{t('systemConfig')}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Languages size={20} color={colors.textMuted} />
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('aiLanguage')}</Text>
          <TouchableOpacity onPress={() => setLangModalOpen(true)}>
            <Text style={[styles.editLink, { color: colors.primary }]}>{t('changeLang')}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.optionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setLangModalOpen(true)}
        >
          <Text style={[styles.optionName, { color: colors.text }]}>
            {profile?.locale === 'es-PE' ? 'Español (Perú)' : 'English (US)'}
          </Text>
          <Text style={[styles.optionDesc, { color: colors.textMuted }]}>
            {t('aiLangDesc')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Sun size={20} color={colors.textMuted} />
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('themeMode')}</Text>
        </View>

        <View style={[styles.themeOptions, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity 
            style={[styles.themeOption, themeMode === 'light' && { backgroundColor: colors.primary + '1a' }]} 
            onPress={() => setMode('light')}
          >
            <Sun size={20} color={themeMode === 'light' ? colors.primary : colors.textMuted} />
            <Text style={[styles.themeText, { color: themeMode === 'light' ? colors.primary : colors.text }]}>{t('lightMode')}</Text>
            {themeMode === 'light' && <Check size={18} color={colors.primary} />}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.themeOption, themeMode === 'dark' && { backgroundColor: colors.primary + '1a' }]} 
            onPress={() => setMode('dark')}
          >
            <Moon size={20} color={themeMode === 'dark' ? colors.primary : colors.textMuted} />
            <Text style={[styles.themeText, { color: themeMode === 'dark' ? colors.primary : colors.text }]}>{t('darkMode')}</Text>
            {themeMode === 'dark' && <Check size={18} color={colors.primary} />}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.themeOption, { borderBottomWidth: 0 }, themeMode === 'system' && { backgroundColor: colors.primary + '1a' }]} 
            onPress={() => setMode('system')}
          >
            <Monitor size={20} color={themeMode === 'system' ? colors.primary : colors.textMuted} />
            <Text style={[styles.themeText, { color: themeMode === 'system' ? colors.primary : colors.text }]}>{t('systemMode')}</Text>
            {themeMode === 'system' && <Check size={18} color={colors.primary} />}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Volume2 size={20} color={colors.textMuted} />
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('ttsSection')}</Text>
        </View>

        <View style={[styles.optionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.ttsRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionName, { color: colors.text, marginBottom: 2 }]}>{t('ttsEnabledLabel')}</Text>
              <Text style={[styles.optionDesc, { color: colors.textMuted }]}>{t('ttsEnabledDesc')}</Text>
            </View>
            <Switch
              value={ttsEnabled}
              onValueChange={setTtsEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>

          {ttsEnabled && (
            <TouchableOpacity
              style={[styles.voiceRow, { borderTopColor: colors.border }]}
              onPress={() => setVoiceModalOpen(true)}
            >
              <Text style={[styles.optionName, { color: colors.text }]}>{t('voiceLabel')}</Text>
              <View style={styles.voiceRowRight}>
                <Text style={[styles.optionDesc, { color: colors.textMuted }]} numberOfLines={1}>
                  {selectedVoiceName}
                </Text>
                <Text style={[styles.editLink, { color: colors.primary }]}>{t('changeLang')}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Modal visible={voiceModalOpen} transparent animationType="fade" onRequestClose={() => { Speech.stop(); setVoiceModalOpen(false); }}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, maxHeight: '70%' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('selectVoice')}</Text>
            <ScrollView>
              <View style={[styles.voiceOption, voiceId === null && { backgroundColor: colors.primary + '1a', borderColor: colors.primary }]}>
                <TouchableOpacity style={styles.voiceOptionMain} onPress={() => { setVoiceId(null); previewVoice(null); }}>
                  <Text style={[styles.langText, { color: colors.text }, voiceId === null && { color: colors.primary, fontWeight: 'bold' }]}>
                    {t('voiceDefault')}
                  </Text>
                </TouchableOpacity>
                {voiceId === null && <Check size={20} color={colors.primary} />}
              </View>

              {voices.length === 0 ? (
                <Text style={[styles.optionDesc, { color: colors.textMuted, padding: 12 }]}>{t('noVoices')}</Text>
              ) : voices.map((v) => {
                const selected = v.identifier === voiceId;
                return (
                  <View key={v.identifier} style={[styles.voiceOption, selected && { backgroundColor: colors.primary + '1a', borderColor: colors.primary }]}>
                    <TouchableOpacity style={styles.voiceOptionMain} onPress={() => setVoiceId(v.identifier)}>
                      <Text style={[styles.langText, { color: colors.text }, selected && { color: colors.primary, fontWeight: 'bold' }]} numberOfLines={1}>
                        {v.name || v.identifier}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => previewVoice(v.identifier)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.previewBtn}>
                      <Play size={16} color={colors.primary} />
                    </TouchableOpacity>
                    {selected && <Check size={20} color={colors.primary} />}
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity onPress={() => { Speech.stop(); setVoiceModalOpen(false); }} style={[styles.modalBtn, { marginTop: 10, alignSelf: 'flex-end' }]}>
              <Text style={{ color: colors.textMuted }}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={langModalOpen} transparent animationType="fade" onRequestClose={() => setLangModalOpen(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('selectLang')}</Text>
            
            <TouchableOpacity 
              style={[styles.langOption, profile?.locale === 'es-PE' && { backgroundColor: colors.primary + '1a', borderColor: colors.primary }]}
              onPress={() => { updateProfile({ locale: 'es-PE' }); setLangModalOpen(false); }}
            >
              <Text style={[styles.langText, { color: colors.text }, profile?.locale === 'es-PE' && { color: colors.primary, fontWeight: 'bold' }]}>Español (Perú)</Text>
              {profile?.locale === 'es-PE' && <Check size={20} color={colors.primary} />}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.langOption, profile?.locale === 'en-US' && { backgroundColor: colors.primary + '1a', borderColor: colors.primary }]}
              onPress={() => { updateProfile({ locale: 'en-US' }); setLangModalOpen(false); }}
            >
              <Text style={[styles.langText, { color: colors.text }, profile?.locale === 'en-US' && { color: colors.primary, fontWeight: 'bold' }]}>English (US)</Text>
              {profile?.locale === 'en-US' && <Check size={20} color={colors.primary} />}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setLangModalOpen(false)} style={[styles.modalBtn, { marginTop: 10, alignSelf: 'flex-end' }]}>
              <Text style={{ color: colors.textMuted }}>{t('close')}</Text>
            </TouchableOpacity>
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
  optionCard: { padding: 16, borderRadius: 16, borderWidth: 1 },
  optionName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  optionDesc: { fontSize: 14 },
  themeOptions: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  themeText: { flex: 1, fontSize: 16, fontWeight: '500' },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 24 },
  modalContent: { borderRadius: 24, padding: 24, gap: 16 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 8,
  },
  langText: { fontSize: 16, flex: 1 },
  ttsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  voiceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 14, gap: 12,
  },
  voiceRowRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  voiceOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', marginBottom: 8,
  },
  voiceOptionMain: { flex: 1 },
  previewBtn: { padding: 4 },
});
