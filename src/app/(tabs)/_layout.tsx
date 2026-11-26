import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { Icon, type IconName } from '../../ui/Icon';
import { Press } from '../../ui/kit';

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Сегодня', icon: 'dumbbell' },
  { name: 'program', title: 'Программа', icon: 'list' },
  { name: 'stats', title: 'Прогресс', icon: 'chart' },
  { name: 'history', title: 'История', icon: 'clock' },
];

function TabButton({ on, title, icon, onPress }: { on: boolean; title: string; icon: IconName; onPress: () => void }) {
  const t = useTheme();
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: withSpring(on ? -2 : 0, { damping: 15 }) }], opacity: withSpring(on ? 1 : 0.9) }));
  const color = on ? t.c.accentText : t.c.muted;
  return (
    <Press onPress={onPress} style={{ flex: 1, alignItems: 'center', paddingTop: 8 }} scaleTo={0.9}>
      <Animated.View style={[{ alignItems: 'center', gap: 3 }, a]}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 4, borderRadius: 999, backgroundColor: on ? t.c.chip : 'transparent' }}>
          <Icon name={icon} size={22} color={color} />
        </View>
        <Text style={{ fontFamily: on ? t.f.bold : t.f.medium, fontSize: 11.5, color }}>{title}</Text>
      </Animated.View>
    </Press>
  );
}

export default function TabsLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.c.bg } }}
      tabBar={({ state, navigation }) => (
        <View style={{ flexDirection: 'row', backgroundColor: t.c.nav, borderTopWidth: 1, borderTopColor: t.c.line, paddingBottom: insets.bottom + 6 }}>
          {state.routes.map((r, i) => {
            const tab = TABS.find((x) => x.name === r.name)!;
            return <TabButton key={r.key} on={state.index === i} title={tab.title} icon={tab.icon} onPress={() => navigation.navigate(r.name)} />;
          })}
        </View>
      )}
    >
      {TABS.map((x) => (
        <Tabs.Screen key={x.name} name={x.name} options={{ title: x.title }} />
      ))}
    </Tabs>
  );
}
