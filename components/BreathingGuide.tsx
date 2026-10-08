import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Check, Info } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';

// Guía de respiración: un círculo que se expande al inhalar y se contrae al
// exhalar, con vibración por fase. Se completa solo tras unos ciclos.
type PhaseKey = 'inhale' | 'hold' | 'exhale';
export type BreathingPattern = '478' | 'box' | 'calm';

const PATTERNS: Record<BreathingPattern, { key: PhaseKey; secs: number }[]> = {
  '478': [{ key: 'inhale', secs: 4 }, { key: 'hold', secs: 7 }, { key: 'exhale', secs: 8 }],
  'box': [{ key: 'inhale', secs: 4 }, { key: 'hold', secs: 4 }, { key: 'exhale', secs: 4 }, { key: 'hold', secs: 4 }],
  'calm': [{ key: 'inhale', secs: 4 }, { key: 'exhale', secs: 6 }],
};

const INFO: Record<BreathingPattern, { name: { es: string; en: string }; how: { es: string; en: string } }> = {
  '478': {
    name: { es: 'Respiración 4-7-8', en: '4-7-8 Breathing' },
    how: {
      es: 'Inhala por la nariz contando 4, mantén el aire contando 7 y exhala lento por la boca contando 8. Repite el ciclo. Ideal para calmar la ansiedad.',
      en: 'Inhale through your nose for 4, hold for 7, and exhale slowly through your mouth for 8. Repeat. Great for calming anxiety.',
    },
  },
  'box': {
    name: { es: 'Respiración cuadrada', en: 'Box breathing' },
    how: {
      es: 'Inhala 4, mantén 4, exhala 4 y mantén 4. Un ciclo "cuadrado" que equilibra y ayuda a enfocarte.',
      en: 'Inhale 4, hold 4, exhale 4, hold 4. A “box” cycle that balances and helps you focus.',
    },
  },
  'calm': {
    name: { es: 'Respiración 4-6', en: '4-6 Breathing' },
    how: {
      es: 'Inhala contando 4 y exhala contando 6, de forma suave y continua. Exhalar más largo activa la calma.',
      en: 'Inhale for 4 and exhale for 6, gently and continuously. A longer exhale switches on calm.',
    },
  },
};

const MAX_CYCLES = 4;
const DONE_HOLD_MS = 2200;
const CIRCLE_MIN = 0.55;
const CIRCLE_MAX = 1;

function haptic(phase: PhaseKey) {
  try {
    if (phase === 'inhale') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else if (phase === 'hold') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch { /* dispositivos sin háptica */ }
}

export function BreathingGuide({
  visible, onClose, pattern = '478',
}: { visible: boolean; onClose: () => void; pattern?: BreathingPattern }) {
  const { colors } = useTheme();
  const { t, locale } = useTranslation();
  const en = locale === 'en-US';
  const scale = useSharedValue(CIRCLE_MIN);
  const phases = PATTERNS[pattern] ?? PATTERNS['478'];
  const info = INFO[pattern] ?? INFO['478'];

  const [phaseIdx, setPhaseIdx] = useState(0);
  const [count, setCount] = useState(phases[0].secs);
  const [done, setDone] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const phaseRef = useRef(0);
  const countRef = useRef(phases[0].secs);
  const cycleRef = useRef(0);

  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    if (!visible) return;

    function startPhase(i: number) {
      const p = phases[i];
      haptic(p.key);
      if (p.key === 'inhale') {
        scale.value = withTiming(CIRCLE_MAX, { duration: p.secs * 1000, easing: Easing.inOut(Easing.ease) });
      } else if (p.key === 'exhale') {
        scale.value = withTiming(CIRCLE_MIN, { duration: p.secs * 1000, easing: Easing.inOut(Easing.ease) });
      }
      // 'hold' mantiene la escala actual
    }

    phaseRef.current = 0;
    countRef.current = phases[0].secs;
    cycleRef.current = 0;
    setPhaseIdx(0);
    setCount(phases[0].secs);
    setDone(false);
    setShowInfo(false);
    scale.value = CIRCLE_MIN;
    startPhase(0);

    const id = setInterval(() => {
      countRef.current -= 1;
      if (countRef.current <= 0) {
        let next = phaseRef.current + 1;
        if (next >= phases.length) {
          cycleRef.current += 1;
          if (cycleRef.current >= MAX_CYCLES) {
            clearInterval(id);
            setDone(true);
            return;
          }
          next = 0;
        }
        phaseRef.current = next;
        countRef.current = phases[next].secs;
        setPhaseIdx(next);
        startPhase(next);
      }
      setCount(countRef.current);
    }, 1000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, pattern]);

  useEffect(() => {
    if (!done) return;
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { /* */ }
    const id = setTimeout(onClose, DONE_HOLD_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const phase = phases[phaseIdx].key;
  const phaseLabel = phase === 'inhale' ? t('breatheInhale') : phase === 'hold' ? t('breatheHold') : t('breatheExhale');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.background }]}>
        <View style={styles.headerBlock}>
          <Text style={[styles.title, { color: colors.text }]}>{t('breatheTitle')}</Text>
          <View style={styles.nameRow}>
            <Text style={[styles.exerciseName, { color: colors.primary }]}>{en ? info.name.en : info.name.es}</Text>
            <TouchableOpacity onPress={() => setShowInfo((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Info size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          {showInfo && (
            <Text style={[styles.infoText, { color: colors.textSecondary, backgroundColor: colors.surfaceElevated }]}>
              {en ? info.how.en : info.how.es}
            </Text>
          )}
        </View>

        <View style={styles.circleArea}>
          <View style={[styles.halo, { borderColor: colors.primary + '33' }]} />
          <Animated.View style={[styles.circle, circleStyle, { backgroundColor: colors.primary + '22', borderColor: colors.primary }]}>
            {done ? (
              <Check size={56} color={colors.primary} strokeWidth={3} />
            ) : (
              <>
                <Text style={[styles.phaseText, { color: colors.primary }]}>{phaseLabel}</Text>
                <Text style={[styles.countText, { color: colors.text }]}>{count}</Text>
              </>
            )}
          </Animated.View>
        </View>

        {done ? (
          <Text style={[styles.doneText, { color: colors.primary }]}>{t('breatheDone')}</Text>
        ) : (
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { borderColor: colors.border }]} activeOpacity={0.8}>
            <Text style={[styles.closeText, { color: colors.textSecondary }]}>{t('breatheClose')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const CIRCLE_SIZE = 220;

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 36, paddingHorizontal: 32 },
  headerBlock: { alignItems: 'center', gap: 6 },
  title: { fontSize: 22, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exerciseName: { fontSize: 15, fontWeight: '700' },
  infoText: { fontSize: 13, lineHeight: 19, textAlign: 'center', borderRadius: 12, padding: 12, marginTop: 6, overflow: 'hidden' },
  circleArea: { width: CIRCLE_SIZE + 60, height: CIRCLE_SIZE + 60, justifyContent: 'center', alignItems: 'center' },
  halo: {
    position: 'absolute', width: CIRCLE_SIZE + 50, height: CIRCLE_SIZE + 50,
    borderRadius: (CIRCLE_SIZE + 50) / 2, borderWidth: 1,
  },
  circle: {
    width: CIRCLE_SIZE, height: CIRCLE_SIZE, borderRadius: CIRCLE_SIZE / 2, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  phaseText: { fontSize: 20, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 },
  countText: { fontSize: 44, fontWeight: '800' },
  doneText: { fontSize: 18, fontWeight: '700' },
  closeBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 999, borderWidth: 1 },
  closeText: { fontSize: 15, fontWeight: '600' },
});
