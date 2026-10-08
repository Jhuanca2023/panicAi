import { useEffect, useRef } from 'react';
import { Animated, Easing, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';

export type SnackbarType = 'success' | 'error' | 'info' | 'warning';
export type SnackbarPosition = 'top' | 'bottom';

export type SnackbarConfig = {
  message: string;
  type?: SnackbarType;
  position?: SnackbarPosition;
  actionLabel?: string;
  onAction?: () => void;
};

// Alto aprox. del tab bar, para levantar el snackbar por encima cuando va abajo.
const TAB_BAR_HEIGHT = 56;

export function Snackbar({
  config,
  onHide,
  duration = 4000,
}: {
  config: SnackbarConfig | null;
  onHide: () => void;
  duration?: number;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const position: SnackbarPosition = config?.position ?? 'bottom';
  const offscreen = position === 'top' ? -120 : 120;
  const translateY = useRef(new Animated.Value(offscreen)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!config) return;

    translateY.setValue(position === 'top' ? -120 : 120);
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 15, stiffness: 180 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();

    hideTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: offscreen, duration: 250, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => onHide());
    }, duration);

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [config, duration, onHide, translateY, opacity, offscreen, position]);

  if (!config) return null;

  const type: SnackbarType = config.type ?? 'success';
  const accent =
    type === 'success' ? colors.primary
    : type === 'error' ? colors.danger
    : type === 'warning' ? '#f59e0b'
    : colors.textSecondary;

  const Icon =
    type === 'success' ? CheckCircle2
    : type === 'error' ? XCircle
    : type === 'warning' ? AlertTriangle
    : Info;

  function handleAction() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    config?.onAction?.();
    onHide();
  }

  const positionStyle = position === 'top'
    ? { top: insets.top + 16 }
    : { bottom: insets.bottom + TAB_BAR_HEIGHT + 16 };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrapper, positionStyle, { transform: [{ translateY }], opacity }]}
    >
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: accent + '88',
          },
        ]}
      >
        <Icon size={20} color={accent} strokeWidth={2.2} />
        <Text style={[styles.message, { color: colors.text }]} numberOfLines={2}>
          {config.message}
        </Text>
        {config.actionLabel && (
          <TouchableOpacity onPress={handleAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.action, { color: accent }]}>{config.actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  message: { flexShrink: 1, fontSize: 14, fontWeight: '500' },
  action: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
});
