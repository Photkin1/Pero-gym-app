// Заставка при запуске: «Per» проявляется, блин прикатывается справа и становится буквой O.
import { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const BG = '#121316';
const ACC = '#ff6b4a';
const R = 30;

export function Intro({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();
  const W = Dimensions.get('window').width;
  const text = useSharedValue(0);
  const roll = useSharedValue(1);
  const out = useSharedValue(1);
  useEffect(() => {
    if (reduced) {
      onDone();
      return;
    }
    text.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) });
    roll.value = withDelay(180, withSpring(0, { damping: 13, stiffness: 90, mass: 0.9 }));
    out.value = withDelay(1350, withTiming(0, { duration: 320 }, (fin) => {
      if (fin) runOnJS(onDone)();
    }));
  }, [reduced, onDone, text, roll, out]);
  const textSt = useAnimatedStyle(() => ({ opacity: text.value, transform: [{ translateX: (1 - text.value) * -16 }] }));
  // Катится: смещение и поворот связаны длиной окружности
  const plateSt = useAnimatedStyle(() => ({ transform: [{ translateX: roll.value * W * 0.7 }, { rotate: `${(roll.value * W * 0.7 * 180) / (Math.PI * R)}deg` }] }));
  const wrap = useAnimatedStyle(() => ({ opacity: out.value, transform: [{ scale: 1 + (1 - out.value) * 0.08 }] }));
  if (reduced) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }, wrap]} pointerEvents="none">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Animated.View style={textSt}>
          <Text style={{ fontFamily: 'Manrope_800ExtraBold', fontSize: 64, color: '#f1f2f4', letterSpacing: -2 }}>Per</Text>
        </Animated.View>
        <Animated.View style={[{ marginTop: 10 }, plateSt]}>
          <Svg width={R * 2 + 4} height={R * 2 + 4} viewBox={`0 0 ${R * 2 + 4} ${R * 2 + 4}`}>
            <Circle cx={R + 2} cy={R + 2} r={R} fill={ACC} />
            <Circle cx={R + 2} cy={R + 2} r={R * 0.8} fill="none" stroke="#fff" strokeOpacity={0.25} strokeWidth={2} />
            <Circle cx={R + 2} cy={R + 2} r={R * 0.52} fill="none" stroke="#fff" strokeOpacity={0.15} strokeWidth={1.5} />
            <Circle cx={R + 2} cy={R + 2} r={R * 0.2} fill={BG} />
            {/* Метка на ободе, чтобы было видно вращение */}
            <Circle cx={R + 2} cy={6} r={2.4} fill="#fff" fillOpacity={0.6} />
          </Svg>
        </Animated.View>
      </View>
      <Animated.Text style={[{ fontFamily: 'Manrope_600SemiBold', fontSize: 14, color: '#8d93a0', marginTop: 14 }, textSt]}>Тяжело в зале, легко в записи</Animated.Text>
    </Animated.View>
  );
}
