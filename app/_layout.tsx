import { useEffect } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { View, ActivityIndicator, StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { ThemeProvider, useTheme } from '../hooks/useTheme';
import { ProfileProvider, useProfile } from '../hooks/useProfile';
import { SymptomsProvider, useSymptoms } from '../hooks/useSymptoms';
import { SpeechSettingsProvider } from '../hooks/useSpeechSettings';
import { SnackbarProvider } from '../hooks/useSnackbar';
import { PanicButton } from '../components/PanicButton';

// Debe coincidir con app/(tabs)/_layout.tsx para apoyar el botón de pánico sobre el tab bar.
const TAB_BAR_BASE_HEIGHT = 70;

function RootNavigator() {
  const { session, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { userSymptoms, loading: symptomsLoading } = useSymptoms();
  const { colors, isDark } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const navState = useRootNavigationState();
  const insets = useSafeAreaInsets();

  // Espera a que el navegador raíz esté montado (navState.key): redirigir antes
  // del <Stack> lanza "action REPLACE was not handled by any navigator".
  const gateBlocked =
    !navState?.key ||
    authLoading ||
    (!!session && (profileLoading || symptomsLoading || !profile));

  useEffect(() => {
    if (gateBlocked) return;

    const group = segments[0];

    if (!session) {
      if (group !== '(auth)') router.replace('/(auth)/login');
      return;
    }

    if (!profile) return;

    // Onboarding en el primer login o cuando el usuario no tiene síntomas registrados.
    const needsOnboarding = !profile.has_completed_onboarding || userSymptoms.length === 0;

    if (needsOnboarding) {
      if (group !== 'onboarding') router.replace('/onboarding');
      return;
    }

    // Sacar del flujo de auth/onboarding y del /index neutro, sin mover al usuario
    // de una pantalla válida a la que navegó él mismo.
    if (group === '(auth)' || group === 'onboarding' || group === undefined) {
      router.replace('/(tabs)');
    }
  }, [gateBlocked, session, profile, userSymptoms.length, segments]);

  // Botón de pánico global visible en toda la app, salvo en estas pantallas.
  const group0 = segments[0];
  const inApp = !!session && !!profile && profile.has_completed_onboarding && userSymptoms.length > 0;
  const noPanicScreens = ['profile-details', 'system-settings', 'service-center', 'dispositivos', 'historial', 'upgrade', 'soporte', 'csmc-map', 'respiracion'];
  const hiddenForPanic =
    group0 === 'crisis' || group0 === '(auth)' || group0 === 'onboarding' || group0 === undefined ||
    noPanicScreens.includes(group0 as string);
  const showPanic = !gateBlocked && inApp && !hiddenForPanic;
  // En las pestañas el botón se apoya sobre el tab bar; en pantallas push va sobre la barra inferior.
  const panicBottom = group0 === '(tabs)'
    ? TAB_BAR_BASE_HEIGHT + insets.bottom - 42
    : insets.bottom + 16;

  // El <Stack> siempre se renderiza para que el navegador raíz quede montado;
  // el loader va encima mientras el gate se resuelve.
  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile-details/index" options={{ headerShown: false }} />
        <Stack.Screen name="system-settings/index" options={{ headerShown: false }} />
        <Stack.Screen name="service-center/index" options={{ headerShown: false }} />
        <Stack.Screen name="dispositivos/index" options={{ headerShown: false }} />
        <Stack.Screen name="csmc-map/index" options={{ headerShown: false }} />
        <Stack.Screen name="historial/[episodeId]" options={{ headerShown: false }} />
        <Stack.Screen name="upgrade/index" options={{ headerShown: false }} />
        <Stack.Screen name="soporte/index" options={{ headerShown: false }} />
        <Stack.Screen name="respiracion/index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/index" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="crisis/index" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
      </Stack>
      {showPanic && <PanicButton bottom={panicBottom} />}
      {gateBlocked && (
        <View style={[styles.loaderOverlay, { backgroundColor: colors.background }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ProfileProvider>
            <SymptomsProvider>
              <SpeechSettingsProvider>
                <SnackbarProvider>
                  <RootNavigator />
                </SnackbarProvider>
              </SpeechSettingsProvider>
            </SymptomsProvider>
          </ProfileProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
