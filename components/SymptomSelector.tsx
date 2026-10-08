import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Check, Plus, X } from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useSymptoms, resolveSymptomName, type Symptom } from '../hooks/useSymptoms';


export function SymptomSelector({ onDone }: { onDone?: () => void }) {
  const { colors } = useTheme();
  const { t, locale } = useTranslation();
  const { catalog, userSymptoms, addPreset, addCustom, remove } = useSymptoms();
  const [custom, setCustom] = useState('');


  const selectedPresets = new Map<string, string>();
  userSymptoms.forEach((us) => {
    if (us.symptom_id) selectedPresets.set(us.symptom_id, us.id);
  });
  const customSymptoms = userSymptoms.filter((us) => us.custom_label);

  function togglePreset(s: Symptom) {
    const existingRow = selectedPresets.get(s.id);
    if (existingRow) remove(existingRow);
    else addPreset(s.id);
  }

  function handleAddCustom() {
    const value = custom.trim();
    if (!value) return;
    addCustom(value);
    setCustom('');
  }

  return (
    <View style={styles.container}>
      <View style={styles.chips}>
        {catalog.map((s) => {
          const selected = selectedPresets.has(s.id);
          return (
            <TouchableOpacity
              key={s.id}
              onPress={() => togglePreset(s)}
              activeOpacity={0.8}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.primary + '22' : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              {selected && <Check size={14} color={colors.primary} strokeWidth={3} />}
              <Text style={[styles.chipText, { color: selected ? colors.primary : colors.text }]}>
                {resolveSymptomName(s, locale)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Síntomas propios (texto libre) */}
      {customSymptoms.length > 0 && (
        <View style={styles.chips}>
          {customSymptoms.map((us) => (
            <View
              key={us.id}
              style={[styles.chip, { backgroundColor: colors.primary + '22', borderColor: colors.primary }]}
            >
              <Text style={[styles.chipText, { color: colors.primary }]}>{us.custom_label}</Text>
              <TouchableOpacity onPress={() => remove(us.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <X size={14} color={colors.primary} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Agregar síntoma propio */}
      <View style={[styles.customRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
        <TextInput
          style={[styles.customInput, { color: colors.text }]}
          value={custom}
          onChangeText={setCustom}
          placeholder={t('symptomCustomPlaceholder')}
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={handleAddCustom}
          returnKeyType="done"
          maxLength={60}
        />
        <TouchableOpacity
          onPress={handleAddCustom}
          disabled={!custom.trim()}
          style={[styles.addBtn, { backgroundColor: colors.primary, opacity: custom.trim() ? 1 : 0.4 }]}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Plus size={18} color={colors.primaryText} />
        </TouchableOpacity>
      </View>

      {onDone && (
        <TouchableOpacity
          onPress={onDone}
          style={[styles.doneBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.doneBtnText, { color: colors.primaryText }]}>
            {t('done')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  customRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 12, paddingLeft: 14, paddingRight: 6, paddingVertical: 6,
  },
  customInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  addBtn: { width: 36, height: 36, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  doneBtn: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: { fontSize: 16, fontWeight: 'bold' },
});
