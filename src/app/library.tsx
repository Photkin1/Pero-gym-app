import { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../theme';
import { useLive } from '../db/hooks';
import { getLibrary, saveCustomExercise } from '../db/repo';
import { pick } from '../features/picker';
import { MUSCLES, type ExerciseDef, type Muscle } from '../core/program';
import { MUSCLE_RU } from '../core/training';
import { Btn, Chip, Field, IconBtn, Press, Row, Segmented, Sheet, Txt, toast } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { ExerciseArt } from '../ui/ExerciseArt';

const GROUPS: { id: string; label: string; muscles: Muscle[] }[] = [
  { id: 'all', label: 'Все', muscles: [] },
  { id: 'chest', label: 'Грудь', muscles: ['chest'] },
  { id: 'back', label: 'Спина', muscles: ['lats', 'upper_back', 'lower_back', 'traps'] },
  { id: 'shoulders', label: 'Плечи', muscles: ['front_delts', 'side_delts', 'rear_delts'] },
  { id: 'arms', label: 'Руки', muscles: ['biceps', 'triceps', 'forearms'] },
  { id: 'legs', label: 'Ноги', muscles: ['quads', 'hamstrings', 'adductors', 'abductors', 'calves'] },
  { id: 'glutes', label: 'Ягодицы', muscles: ['glutes'] },
  { id: 'abs', label: 'Пресс', muscles: ['abs'] },
];

const slug = (s: string) => {
  const map: Record<string, string> = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya' };
  return s.toLowerCase().split('').map((c) => map[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'custom';
};

export default function Library() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { pick: pickMode } = useLocalSearchParams<{ pick?: string }>();
  const lib = useLive(() => getLibrary());
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);

  const list = useMemo(() => {
    const g = GROUPS.find((x) => x.id === group)!;
    const s = q.trim().toLowerCase();
    return lib
      .filter((e) => !g.muscles.length || e.muscles.primary.some((m) => g.muscles.includes(m)))
      .filter((e) => !s || e.name.toLowerCase().includes(s) || e.id.includes(s))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [lib, q, group]);

  const choose = (e: ExerciseDef) => {
    if (pickMode) {
      router.back();
      pick(e.id);
    } else router.push(`/exercise/${e.id}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, paddingTop: insets.top + 6 }}>
      <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 8 }}>
        <Row>
          <Txt v="title" style={{ flex: 1 }}>{pickMode ? 'Выбери упражнение' : 'Упражнения'}</Txt>
          <IconBtn name="close" onPress={() => router.back()} label="Закрыть" bg={t.c.chip} />
        </Row>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.c.input, borderRadius: t.r.md, paddingHorizontal: 12, gap: 8 }}>
          <Icon name="search" size={18} color={t.c.muted} />
          <Field value={q} onChangeText={setQ} placeholder="Поиск: жим, присед, тяга…" style={{ backgroundColor: 'transparent', paddingHorizontal: 0, flex: 1 }} autoCorrect={false} />
        </View>
        <FlatList
          horizontal
          data={GROUPS}
          keyExtractor={(g) => g.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => <Chip label={item.label} on={group === item.id} onPress={() => setGroup(item.id)} />}
        />
      </View>
      <FlatList
        data={list}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: 16, paddingTop: 6, gap: 8, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={
          <Btn kind="secondary" icon="plus" title="Своё упражнение" onPress={() => setCreateOpen(true)} style={{ marginTop: 8 }} />
        }
        ListEmptyComponent={<Txt v="small" center style={{ marginTop: 30 }}>Ничего не нашлось. Создай своё упражнение.</Txt>}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeIn.delay(Math.min(index, 10) * 20)}>
            <Press onPress={() => choose(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.c.card, borderRadius: t.r.md, padding: 10, borderWidth: t.border, borderColor: t.c.line }}>
              <ExerciseArt def={item} size={44} />
              <View style={{ flex: 1 }}>
                <Txt v="medium" numberOfLines={1}>{item.name}</Txt>
                <Txt v="small" numberOfLines={1}>{item.muscles.primary.map((m) => MUSCLE_RU[m]).join(', ')}{item.variants?.length ? ` · ${item.variants.length} ${item.variants.length < 5 ? 'варианта' : 'вариантов'}` : ''}</Txt>
              </View>
              <Icon name={pickMode ? 'plus' : 'chevron'} size={20} color={pickMode ? t.c.accentText : t.c.muted} />
            </Press>
          </Animated.View>
        )}
      />
      <CreateSheet open={createOpen} onClose={() => setCreateOpen(false)} existing={new Set(lib.map((e) => e.id))} onCreated={(e) => { setCreateOpen(false); toast('Упражнение создано', 'check'); choose(e); }} initialName={q} />
    </View>
  );
}

function CreateSheet({ open, onClose, existing, onCreated, initialName }: { open: boolean; onClose: () => void; existing: Set<string>; onCreated: (e: ExerciseDef) => void; initialName: string }) {
  const [name, setName] = useState(initialName);
  const [muscle, setMuscle] = useState<Muscle>('chest');
  const [type, setType] = useState<'weight' | 'bodyweight' | 'time'>('weight');
  const [sides, setSides] = useState<'both' | 'optional'>('both');
  const t = useTheme();
  const save = () => {
    if (!name.trim()) return;
    let id = slug(name);
    let i = 2;
    while (existing.has(id)) id = `${slug(name)}-${i++}`;
    const e: ExerciseDef = { id, name: name.trim(), muscles: { primary: [muscle] }, type, sides, increment: type === 'weight' ? 2.5 : undefined };
    saveCustomExercise(e);
    onCreated(e);
  };
  return (
    <Sheet open={open} onClose={onClose} title="Новое упражнение">
      <Field label="Название" value={name} onChangeText={setName} placeholder="Например, жим Арнольда" />
      <Txt v="label">Основная мышца</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {MUSCLES.map((m) => <Chip key={m} small label={MUSCLE_RU[m]} on={muscle === m} onPress={() => setMuscle(m)} />)}
      </View>
      <Txt v="label">Что записывать</Txt>
      <Segmented value={type} onChange={setType} options={[{ id: 'weight', label: 'Вес × повт' }, { id: 'bodyweight', label: 'Свой вес' }, { id: 'time', label: 'Время' }]} />
      <Txt v="label">Стороны</Txt>
      <Segmented value={sides} onChange={setSides} options={[{ id: 'both', label: 'Всегда обе' }, { id: 'optional', label: 'Можно по одной' }]} />
      <Text style={{ fontFamily: t.f.body, color: t.c.muted, fontSize: 12.5 }}>Упражнение сохранится в библиотеке на этом телефоне.</Text>
      <Btn title="Создать" onPress={save} disabled={!name.trim()} />
    </Sheet>
  );
}
