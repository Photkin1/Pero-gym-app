// Базовые элементы интерфейса. Экраны собираются только из них, поэтому темы и анимации работают везде одинаково.
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import Animated, {
  Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme';
import { Icon, type IconName } from './Icon';

export const tap = () => Haptics.selectionAsync().catch(() => {});
export const thud = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
export const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

// ───────── Текст ─────────

type TxtVariant = 'title' | 'h2' | 'h3' | 'body' | 'medium' | 'small' | 'label' | 'num' | 'bignum';
export function Txt({ v = 'body', color, style, children, numberOfLines, center }: { v?: TxtVariant; color?: string; style?: StyleProp<TextStyle>; children: ReactNode; numberOfLines?: number; center?: boolean }) {
  const t = useTheme();
  const base: Record<TxtVariant, TextStyle> = {
    title: { fontFamily: t.f.display, fontSize: t.id === 'energy' ? 24 : 28, lineHeight: t.id === 'energy' ? 30 : 32, letterSpacing: -0.5 },
    h2: { fontFamily: t.f.display, fontSize: t.id === 'energy' ? 16 : 19, lineHeight: 24, letterSpacing: -0.2 },
    h3: { fontFamily: t.f.bold, fontSize: 16, lineHeight: 21 },
    body: { fontFamily: t.f.body, fontSize: 15.5, lineHeight: 22 },
    medium: { fontFamily: t.f.semibold, fontSize: 15, lineHeight: 20 },
    small: { fontFamily: t.f.body, fontSize: 13, lineHeight: 18 },
    label: { fontFamily: t.f.medium, fontSize: 12.5, lineHeight: 16 },
    num: { fontFamily: t.f.num, fontSize: 17, fontVariant: ['tabular-nums'] },
    bignum: { fontFamily: t.f.num, fontSize: 34, lineHeight: 38, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  };
  const muted = v === 'small' || v === 'label';
  return (
    <Text numberOfLines={numberOfLines} style={[base[v], { color: color ?? (muted ? t.c.muted : t.c.ink) }, center && { textAlign: 'center' }, style]}>
      {children}
    </Text>
  );
}

// ───────── Нажимаемая область с пружинкой ─────────

// Свойства, которые отвечают за место элемента среди соседей: их должен получить сам Pressable,
// иначе в строке он сжимается до содержимого и flex: 1 / width у внутреннего блока не работают
const OUTER_KEYS = ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'width', 'minWidth', 'maxWidth', 'alignSelf', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical', 'position', 'top', 'left', 'right', 'bottom', 'zIndex'] as const;

function splitStyle(style: StyleProp<ViewStyle>) {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) ((OUTER_KEYS as readonly string[]).includes(k) ? outer : inner)[k] = v;
  // Растянутый по главной оси Pressable должен растянуть и содержимое
  if (outer.flex != null || outer.flexGrow != null) inner.flexGrow = 1;
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

export function Press({ onPress, onLongPress, style, children, disabled, haptic = true, scaleTo = 0.97, hitSlop }: { onPress?: () => void; onLongPress?: () => void; style?: StyleProp<ViewStyle>; children: ReactNode; disabled?: boolean; haptic?: boolean; scaleTo?: number; hitSlop?: number }) {
  const s = useSharedValue(1);
  const { outer, inner } = splitStyle(style);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => (s.value = withSpring(scaleTo, { damping: 20, stiffness: 400 }))}
      onPressOut={() => (s.value = withSpring(1, { damping: 14, stiffness: 300 }))}
      onPress={() => {
        if (haptic) tap();
        onPress?.();
      }}
      onLongPress={onLongPress}
      style={outer}
    >
      <Animated.View style={[inner, a, disabled && { opacity: 0.45 }]}>{children}</Animated.View>
    </Pressable>
  );
}

// ───────── Карточка ─────────

export function Card({ children, style, onPress, pad = 14 }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; pad?: number }) {
  const t = useTheme();
  const st: ViewStyle = {
    backgroundColor: t.c.card,
    borderRadius: t.r.lg,
    padding: pad,
    borderWidth: t.border,
    borderColor: t.c.line,
    ...(t.shadow ? { shadowColor: '#1f3cff', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 } : null),
  };
  if (onPress) return <Press onPress={onPress} style={[st, style]}>{children}</Press>;
  return <View style={[st, style]}>{children}</View>;
}

// ───────── Кнопки ─────────

export function Btn({ title, onPress, kind = 'primary', icon, style, disabled, small, full }: { title: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: IconName; style?: StyleProp<ViewStyle>; disabled?: boolean; small?: boolean; full?: boolean }) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.c.accent : kind === 'secondary' ? t.c.chip : kind === 'danger' ? 'transparent' : 'transparent';
  const fg = kind === 'primary' ? t.c.onAccent : kind === 'danger' ? t.c.bad : kind === 'ghost' ? t.c.accentText : t.c.ink;
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      style={[
        { backgroundColor: bg, borderRadius: t.r.md, minHeight: small ? 38 : 52, paddingHorizontal: small ? 12 : 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
        full && { alignSelf: 'stretch' },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={small ? 17 : 20} color={fg} />}
      <Text style={{ fontFamily: t.f.bold, fontSize: small ? 14 : 16, color: fg }}>{title}</Text>
    </Press>
  );
}

export function IconBtn({ name, onPress, color, bg, size = 40, label }: { name: IconName; onPress: () => void; color?: string; bg?: string; size?: number; label?: string }) {
  const t = useTheme();
  return (
    <Press onPress={onPress} hitSlop={6} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg ?? 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      <View accessible accessibilityLabel={label} accessibilityRole="button">
        <Icon name={name} size={Math.round(size * 0.52)} color={color ?? t.c.ink} />
      </View>
    </Press>
  );
}

export function Chip({ label, on, onPress, small }: { label: string; on?: boolean; onPress?: () => void; small?: boolean }) {
  const t = useTheme();
  return (
    <Press
      onPress={onPress}
      disabled={!onPress}
      style={{ backgroundColor: on ? t.c.accent : t.c.chip, borderRadius: 999, paddingHorizontal: small ? 9 : 13, paddingVertical: small ? 3 : 7 }}
    >
      <Text style={{ fontFamily: t.f.semibold, fontSize: small ? 12 : 13.5, color: on ? t.c.onAccent : t.c.ink }}>{label}</Text>
    </Press>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.c.chip, borderRadius: t.r.md, padding: 3 }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Press key={o.id} onPress={() => onChange(o.id)} style={{ flex: 1 }}>
            <View style={{ paddingVertical: 8, borderRadius: t.r.md - 3, backgroundColor: on ? t.c.card : 'transparent', alignItems: 'center' }}>
              <Text style={{ fontFamily: on ? t.f.bold : t.f.medium, fontSize: 13.5, color: on ? t.c.ink : t.c.muted }}>{o.label}</Text>
            </View>
          </Press>
        );
      })}
    </View>
  );
}

// ───────── Поля ввода ─────────

export function Field({ label, style, ...rest }: TextInputProps & { label?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label && <Txt v="label">{label}</Txt>}
      <TextInput
        placeholderTextColor={t.c.faint}
        selectionColor={t.c.accent}
        {...rest}
        style={[{ backgroundColor: t.c.input, color: t.c.ink, borderRadius: t.r.md, paddingHorizontal: 14, paddingVertical: 12, fontFamily: t.f.medium, fontSize: 16 }, style]}
      />
    </View>
  );
}

// ───────── Экран и заголовок ─────────

export function Screen({ title, subtitle, children, right, back, scroll = true, footer, headerBand }: { title?: string; subtitle?: string; children: ReactNode; right?: ReactNode; back?: boolean; scroll?: boolean; footer?: ReactNode; headerBand?: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const band = headerBand && t.id === 'energy';
  const head = (title || back || right) && (
    <View style={[{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: band ? 22 : 10, backgroundColor: band ? t.c.header : t.c.bg }, band && { borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40 }}>
        {back && <IconBtn name="back" onPress={() => router.back()} color={band ? t.c.onHeader : t.c.ink} label="Назад" />}
        <View style={{ flex: 1 }} />
        {right}
      </View>
      {title && <Txt v="title" color={band ? t.c.onHeader : t.c.ink} style={{ marginTop: 2 }}>{title}</Txt>}
      {subtitle && <Txt v="small" color={band ? t.c.onHeaderMuted : t.c.muted} style={{ marginTop: 4 }}>{subtitle}</Txt>}
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      {head}
      {scroll ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: band ? 18 : 6, paddingBottom: 120 + insets.bottom, gap: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
      {footer}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 2 }}>
      <Txt v="h2">{children}</Txt>
      {right}
    </View>
  );
}

export function Row({ children, style, gap = 10 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: t.c.line }} />;
}

export function Empty({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(300)} style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 10 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.c.chip, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={30} color={t.c.muted} />
      </View>
      <Txt v="h3" center>{title}</Txt>
      <Txt v="small" center>{text}</Txt>
      {action}
    </Animated.View>
  );
}

// ───────── Нижняя шторка ─────────

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // Без пружины и без анимации закрытия: шторка выезжает за ~140 мс и исчезает мгновенно
  const ty = useSharedValue(SHEET_START);
  const scrim = useSharedValue(0);
  useEffect(() => {
    if (open) {
      ty.value = SHEET_START;
      scrim.value = 0;
      ty.value = withTiming(0, { duration: 140, easing: Easing.out(Easing.cubic) });
      scrim.value = withTiming(1, { duration: 120 });
    }
  }, [open]);
  // Смахивание вниз за верхнюю часть шторки (полоска и заголовок)
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          ty.value = Math.max(0, g.dy);
          scrim.value = Math.max(0.3, 1 - g.dy / 500);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 70 || g.vy > 0.6) closeRef.current();
          else {
            ty.value = withTiming(0, { duration: 120 });
            scrim.value = withTiming(1, { duration: 120 });
          }
        },
        onPanResponderTerminate: () => {
          ty.value = withTiming(0, { duration: 120 });
          scrim.value = withTiming(1, { duration: 120 });
        },
      }),
    [],
  );
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));
  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      {open && (
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.c.scrim }, scrimStyle]}>
            <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Закрыть" />
          </Animated.View>
          <Animated.View
            style={[{ backgroundColor: t.c.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 10, paddingBottom: insets.bottom + 18, maxHeight: '88%' }, sheetStyle]}
          >
            <View {...pan.panHandlers} style={{ marginHorizontal: -18, paddingHorizontal: 18, marginTop: -10, paddingTop: 10 }}>
              <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: t.c.chip, marginBottom: 12 }} />
              {title ? <Txt v="h2" style={{ marginBottom: 12 }}>{title}</Txt> : <View style={{ height: 8 }} />}
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {children}
            </ScrollView>
          </Animated.View>
        </View>
      )}
    </Modal>
  );
}
const SHEET_START = 420;

// ───────── Всплывающее сообщение ─────────

let toastSetter: ((m: { text: string; icon?: IconName } | null) => void) | null = null;
export function toast(text: string, icon?: IconName) {
  toastSetter?.({ text, icon });
}
import { useState } from 'react';
export function ToastHost() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [m, setM] = useState<{ text: string; icon?: IconName } | null>(null);
  useEffect(() => {
    toastSetter = setM;
    return () => {
      toastSetter = null;
    };
  }, []);
  useEffect(() => {
    if (!m) return;
    const id = setTimeout(() => setM(null), 2600);
    return () => clearTimeout(id);
  }, [m]);
  if (!m) return null;
  return (
    <Animated.View
      key={m.text}
      entering={FadeIn.duration(120)}
      exiting={FadeOut.duration(120)}
      pointerEvents="none"
      style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 92, backgroundColor: t.dark ? '#f1f2f4' : '#15171a', borderRadius: 16, paddingVertical: 13, paddingHorizontal: 16, flexDirection: 'row', gap: 10, alignItems: 'center' }}
    >
      {m.icon && <Icon name={m.icon} size={20} color={t.c.accent} />}
      <Text style={{ fontFamily: t.f.semibold, fontSize: 14.5, color: t.dark ? '#121316' : '#ffffff', flex: 1 }}>{m.text}</Text>
    </Animated.View>
  );
}

// ───────── Полоса прогресса ─────────

export function Bar({ value, color, height = 8, bg }: { value: number; color?: string; height?: number; bg?: string }) {
  const t = useTheme();
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(1, value)), { duration: 500 });
  }, [value, w]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: bg ?? t.c.chip, overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', borderRadius: height, backgroundColor: color ?? t.c.accent }, a]} />
    </View>
  );
}
