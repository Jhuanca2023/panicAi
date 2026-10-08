import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmText: string;
  cancelText?: string;
  variant?: 'destructive' | 'primary';
  loading?: boolean;
  // Si se pasa, muestra un checkbox "no volver a preguntar"; su estado vuelve por onConfirm.
  dontAskAgainLabel?: string;
  onConfirm: (dontAskAgain: boolean) => void;
  onCancel: () => void;
};

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'primary',
  loading = false,
  dontAskAgainLabel,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { colors } = useTheme();
  const [dontAskAgain, setDontAskAgain] = useState(false);

  // Resetea el checkbox al abrir para que no arrastre la elección anterior.
  useEffect(() => {
    if (visible) setDontAskAgain(false);
  }, [visible]);

  const confirmColor = variant === 'destructive' ? colors.danger : colors.primary;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          {cancelText !== undefined && (
            <TouchableOpacity
              onPress={onCancel}
              disabled={loading}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
          ) : null}
          {dontAskAgainLabel && (
            <TouchableOpacity
              onPress={() => setDontAskAgain((v) => !v)}
              style={styles.checkboxRow}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <View style={[
                styles.checkbox,
                {
                  borderColor: dontAskAgain ? colors.primary : colors.border,
                  backgroundColor: dontAskAgain ? colors.primary + '20' : 'transparent',
                },
              ]}>
                {dontAskAgain && <Check size={12} color={colors.primary} strokeWidth={3} />}
              </View>
              <Text style={[styles.checkboxLabel, { color: colors.textSecondary }]}>
                {dontAskAgainLabel}
              </Text>
            </TouchableOpacity>
          )}
          <View style={styles.actions}>
            {cancelText !== undefined && (
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.surface, opacity: loading ? 0.5 : 1 }]}
                onPress={onCancel}
                disabled={loading}
              >
                <Text style={[styles.buttonText, { color: colors.textSecondary }]}>
                  {cancelText}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.button, { backgroundColor: confirmColor + '20', borderWidth: 1, borderColor: confirmColor + '33', opacity: loading ? 0.7 : 1 }]}
              onPress={() => onConfirm(dontAskAgain)}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator size="small" color={confirmColor} />
                : <Text style={[styles.buttonText, { color: confirmColor }]}>{confirmText}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  container: {
    width: '100%', borderRadius: 16, borderWidth: 1,
    padding: 24, gap: 12,
  },
  closeBtn: { position: 'absolute', top: 12, right: 12, padding: 4, zIndex: 1 },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  message: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  button: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  checkbox: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxLabel: { fontSize: 13 },
});
