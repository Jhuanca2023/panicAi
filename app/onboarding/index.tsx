import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeartPulse, ClipboardList, Mic, Check, ChevronLeft, UserRound } from 'lucide-react-native';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { useTheme } from '../../hooks/useTheme';
import { useProfile, type Gender } from '../../hooks/useProfile';
import { useSymptoms } from '../../hooks/useSymptoms';
import { SymptomSelector } from '../../components/SymptomSelector';
import { useTranslation } from '../../hooks/useTranslation';

type MicStatus = 'undetermined' | 'granted' | 'denied';

const STEPS = ['welcome', 'about', 'symptoms', 'microphone'] as const;

const GENDER_OPTIONS: Gender[] = ['female', 'male', 'prefer_not'];

const GENDER_LABELS: Record<string, Record<Gender, string>> = {
  'es-PE': {
    female: 'Mujer',
    male: 'Hombre',
    nonbinary: 'No binario',
    prefer_not: 'Prefiero no decir',
  },
  'en-US': {
    female: 'Female',
    male: 'Male',
    nonbinary: 'Non-binary',
    prefer_not: 'Prefer not to say',
  }
};

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, updateProfile } = useProfile();
  const { hasSymptoms } = useSymptoms();

  const { t, locale } = useTranslation();
  const [step, setStep] = useState(0);
  const [micStatus, setMicStatus] = useState<MicStatus>('undetermined');
  const [finishing, setFinishing] = useState(false);

  
  const [name, setName] = useState(profile?.display_name ?? '');
  const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null);

  useEffect(() => {
    getRecordingPermissionsAsync()
      .then((res) => setMicStatus(res.granted ? 'granted' : res.canAskAgain ? 'undetermined' : 'denied'))
      .catch(() => {});
  }, []);

  async function requestMic() {
    try {
      const res = await requestRecordingPermissionsAsync();
      setMicStatus(res.granted ? 'granted' : 'denied');
    } catch {
      setMicStatus('denied');
    }
  }

  async function finish() {
    setFinishing(true);
    await updateProfile({ has_completed_onboarding: true });
    router.replace('/(tabs)');
  }

  async function saveAbout() {
    const patch: { display_name?: string; gender?: Gender } = {};
    const trimmed = name.trim();
    if (trimmed && trimmed !== profile?.display_name) patch.display_name = trimmed;
    if (gender && gender !== profile?.gender) patch.gender = gender;
    if (Object.keys(patch).length > 0) await updateProfile(patch);
  }

  const isLast = step === STEPS.length - 1;
  const canContinue = STEPS[step] === 'symptoms' ? hasSymptoms : true;

  function handleNext() {
    if (STEPS[step] === 'about') saveAbout();
    if (isLast) finish();
    else setStep((s) => s + 1);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      // 'padding' (no 'height') evita el hueco residual al cerrar el teclado en Android.
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        {step > 0 ? (
          <TouchableOpacity onPress={() => setStep((s) => s - 1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ChevronLeft size={26} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 26 }} />
        )}
        <View style={styles.dots}>
          {STEPS.map((s, i) => (
            <View
              key={s}
              style={[styles.dot, { backgroundColor: i <= step ? colors.primary : colors.border }]}
            />
          ))}
        </View>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {STEPS[step] === 'welcome' && (
          <View style={styles.centered}>
            <View style={[styles.iconWrap, { backgroundColor: colors.primary + '1a' }]}>
              <HeartPulse size={52} color={colors.primary} strokeWidth={1.8} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{t('welcomeTitle')}</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>{t('welcomeBody')}</Text>
          </View>
        )}

        {STEPS[step] === 'about' && (
          <View style={styles.stepBlock}>
            <View style={[styles.iconWrapSmall, { backgroundColor: colors.primary + '1a' }]}>
              <UserRound size={28} color={colors.primary} strokeWidth={1.8} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{t('aboutTitle')}</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>{t('aboutBody')}</Text>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('nameLabel')}</Text>
            <TextInput
              style={[styles.nameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
              value={name}
              onChangeText={setName}
              placeholder={t('namePlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              maxLength={40}
              returnKeyType="done"
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('genderLabel')}</Text>
            <View style={styles.genderChips}>
              {GENDER_OPTIONS.map((g) => {
                const selected = gender === g;
                return (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setGender(selected ? null : g)}
                    activeOpacity={0.8}
                    style={[
                      styles.genderChip,
                      {
                        backgroundColor: selected ? colors.primary + '22' : colors.surface,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    {selected && <Check size={14} color={colors.primary} strokeWidth={3} />}
                    <Text style={[styles.genderChipText, { color: selected ? colors.primary : colors.text }]}>
                      {GENDER_LABELS[locale === 'en-US' ? 'en-US' : 'es-PE'][g]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {STEPS[step] === 'symptoms' && (
          <View style={styles.stepBlock}>
            <View style={[styles.iconWrapSmall, { backgroundColor: colors.primary + '1a' }]}>
              <ClipboardList size={28} color={colors.primary} strokeWidth={1.8} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{t('symptomsTitle')}</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>{t('symptomsBody')}</Text>
            <View style={styles.selector}>
              <SymptomSelector />
            </View>
          </View>
        )}

        {STEPS[step] === 'microphone' && (
          <View style={styles.centered}>
            <View style={[styles.iconWrap, { backgroundColor: colors.primary + '1a' }]}>
              <Mic size={52} color={colors.primary} strokeWidth={1.8} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{t('micTitle')}</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>{t('micBody')}</Text>

            {micStatus === 'granted' ? (
              <View style={[styles.micGranted, { borderColor: colors.primary }]}>
                <Check size={18} color={colors.primary} strokeWidth={3} />
                <Text style={[styles.micGrantedText, { color: colors.primary }]}>{t('micGranted')}</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.secondaryBtn, { borderColor: colors.primary }]}
                  onPress={requestMic}
                  activeOpacity={0.85}
                >
                  <Mic size={18} color={colors.primary} />
                  <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>{t('allowMic')}</Text>
                </TouchableOpacity>
                {micStatus === 'denied' && (
                  <Text style={[styles.micHint, { color: colors.textMuted }]}>{t('micDeniedBody')}</Text>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }, !canContinue && styles.btnDisabled]}
          onPress={handleNext}
          disabled={!canContinue || finishing}
          activeOpacity={0.85}
        >
          {finishing ? (
            <ActivityIndicator size="small" color={colors.primaryText} />
          ) : (
            <Text style={[styles.primaryBtnText, { color: colors.primaryText }]}>
              {isLast ? t('start') : t('continue')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 8,
  },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  stepBlock: { gap: 14 },
  iconWrap: { width: 104, height: 104, borderRadius: 52, justifyContent: 'center', alignItems: 'center' },
  iconWrapSmall: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 320 },
  selector: { marginTop: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  nameInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  genderChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  genderChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9,
  },
  genderChipText: { fontSize: 14, fontWeight: '600' },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 14, marginTop: 8,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '700' },
  micGranted: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 14, marginTop: 8,
  },
  micGrantedText: { fontSize: 15, fontWeight: '700' },
  micHint: { fontSize: 13, textAlign: 'center', maxWidth: 300, marginTop: 4 },
  footer: { paddingHorizontal: 24, paddingTop: 8 },
  primaryBtn: {
    padding: 16, borderRadius: 12,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4,
  },
  primaryBtnText: { textAlign: 'center', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
});
