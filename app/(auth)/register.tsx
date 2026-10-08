import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { signInWithGoogle, isGoogleSignInAvailable } from '../../lib/oauth';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { ConfirmModal } from '../../components/ConfirmModal';
import { GoogleLogo } from '../../components/GoogleLogo';
import { authErrorMessage } from '../../lib/authErrors';

export default function RegisterScreen() {
  const { colors } = useTheme();
  const { t, locale } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [infoModal, setInfoModal] = useState<{ title: string; message: string; success?: boolean } | null>(null);
  // En Expo Go no hay módulo nativo de Google → se oculta el botón.
  const googleAvailable = isGoogleSignInAvailable();

  async function handleRegister() {
    if (!email || !password) {
      setInfoModal({ title: t('error'), message: t('errorFields') });
      return;
    }
    if (password.length < 6) {
      setInfoModal({ title: t('error'), message: t('errorPasswordLength') });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setInfoModal({ title: t('error'), message: authErrorMessage(error, locale) });
    } else {
      setInfoModal({ title: t('successRegisterTitle'), message: t('successRegister'), success: true });
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    setGoogleLoading(false);
    if (error && error !== 'cancelled') {
      setInfoModal({ title: t('error'), message: t('googleError') });
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={[styles.brand, { color: colors.primary }]}>PanicAI</Text>
        <Text style={[styles.tagline, { color: colors.textMuted }]}>{t('authTagline')}</Text>
      </View>

      <View style={styles.form}>
        <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
          <Mail size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={t('email')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
          <Lock size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={t('password')}
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword((s) => !s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {showPassword
              ? <EyeOff size={18} color={colors.textMuted} />
              : <Eye size={18} color={colors.textMuted} />
            }
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.primaryBtn,
            { backgroundColor: colors.primary, shadowColor: colors.primary },
            (loading || googleLoading) && styles.btnDisabled,
          ]}
          onPress={handleRegister}
          disabled={loading || googleLoading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator size="small" color={colors.primaryText} />
            : <Text style={[styles.primaryBtnText, { color: colors.primaryText }]}>{t('createAccount')}</Text>
          }
        </TouchableOpacity>

        {googleAvailable && (
          <>
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textMuted }]}>{t('orDivider')}</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <TouchableOpacity
              style={[styles.googleBtn, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }, (loading || googleLoading) && styles.btnDisabled]}
              onPress={handleGoogle}
              disabled={loading || googleLoading}
              activeOpacity={0.85}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <>
                  <GoogleLogo size={20} />
                  <Text style={[styles.googleBtnText, { color: colors.text }]}>{t('continueGoogle')}</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      <Link href="/(auth)/login" style={styles.link}>
        <Text style={[styles.linkText, { color: colors.primary }]}>
          {t('haveAccount')}
        </Text>
      </Link>

      <ConfirmModal
        visible={!!infoModal}
        title={infoModal?.title ?? ''}
        message={infoModal?.message}
        confirmText={t('ok')}
        variant={infoModal?.success ? 'primary' : 'destructive'}
        onConfirm={() => setInfoModal(null)}
        onCancel={() => setInfoModal(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 36 },
  brand: { fontSize: 40, fontWeight: '800', letterSpacing: -1, marginBottom: 12 },
  tagline: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  form: { gap: 12 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 2,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 14 },
  primaryBtn: {
    padding: 16, borderRadius: 12, marginTop: 8,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
  },
  primaryBtnText: { textAlign: 'center', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  googleBtnText: { fontSize: 15, fontWeight: '600' },
  link: { marginTop: 24, alignSelf: 'center' },
  linkText: { fontSize: 14 },
});
