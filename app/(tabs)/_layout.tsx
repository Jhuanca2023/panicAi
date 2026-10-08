import React from 'react';
import { View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Home, Activity, BookText, Settings, Crown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useProfile } from '../../hooks/useProfile';

// Hueco central entre íconos para que el botón de pánico global se apoye sin taparlos.
const PANIC_GAP = 56;

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useProfile();
  const isPremium = profile?.plan === 'plus';

  // Corona dorada sobre el Monitor cuando el usuario es Free (es feature Plus).
  const MonitorIcon = ({ color }: { color: string }) => (
    <View>
      <Activity size={28} color={color} />
      {!isPremium && (
        <View style={{ position: 'absolute', top: -7, right: -9 }}>
          <Crown size={15} color="#F59E0B" fill="#F59E0B" />
        </View>
      )}
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          // Suma el área segura inferior para no quedar bajo la barra de navegación del sistema.
          height: 70 + insets.bottom,
          paddingBottom: 10 + insets.bottom,
          paddingTop: 10,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          position: 'absolute',
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ tabBarIcon: ({ color }) => <Home size={28} color={color} /> }}
      />
      <Tabs.Screen
        name="historial/index"
        options={{
          tabBarIcon: ({ color }) => <BookText size={28} color={color} />,
          tabBarItemStyle: { marginRight: PANIC_GAP },
        }}
      />
      <Tabs.Screen
        name="monitor"
        options={{
          tabBarIcon: ({ color }) => <MonitorIcon color={color} />,
          tabBarItemStyle: { marginLeft: PANIC_GAP },
        }}
        listeners={{
          tabPress: (e) => {
            // Free no entra al monitor: lo llevamos a la pantalla de upgrade.
            if (!isPremium) {
              e.preventDefault();
              router.push('/upgrade');
            }
          },
        }}
      />
      <Tabs.Screen
        name="perfil/index"
        options={{ tabBarIcon: ({ color }) => <Settings size={28} color={color} /> }}
      />
    </Tabs>
  );
}
