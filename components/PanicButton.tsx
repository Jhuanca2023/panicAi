import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';

// Botón de pánico global que flota sobre cualquier pantalla para entrar al Modo
// Crisis. El layout calcula `bottom` según la pantalla (sobre el tab bar o la barra del sistema).
export function PanicButton({ bottom }: { bottom: number }) {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <Pressable
        onPress={() => router.push('/crisis')}
        accessibilityRole="button"
        accessibilityLabel="Modo Crisis"
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: colors.danger, shadowColor: colors.danger },
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.label}>PANIC!</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  btn: {
    width: 92,
    height: 92,
    borderRadius: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  pressed: { transform: [{ scale: 0.94 }], shadowOpacity: 0.25 },
  label: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
});
