// Работа с файлами: экспорт в Excel, бэкап, импорт и выгрузка программ.
// Файл пишется во временную папку, потом открывается системное меню «Поделиться»
// (Telegram, Google Диск, почта, сохранить на телефон).
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';
import { dumpAll, getActiveProgram, listBody, listSessions, restoreAll, setsBetween, type Backup } from '../db/repo';
import { defsFor } from './session';
import { e1rm, MUSCLE_RU, setsPerMuscle } from '../core/training';
import { serializeProgram, type Program } from '../core/program';
import docs from '../data/docs.json';

const stamp = () => new Date().toISOString().slice(0, 10);

async function share(name: string, content: string | Uint8Array, mimeType: string) {
  if (Platform.OS === 'web') return shareWeb(name, content, mimeType);
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  await f.write(content);
  if (!(await Sharing.isAvailableAsync())) throw new Error('На этом устройстве нельзя поделиться файлом');
  await Sharing.shareAsync(f.uri, { mimeType, dialogTitle: name });
}

// В браузере нет файловой системы Expo: отдаём файл через системное меню «Поделиться», а если его нет — скачиванием
async function shareWeb(name: string, content: string | Uint8Array, mimeType: string) {
  const blob = new Blob([content as BlobPart], { type: mimeType });
  const file = new globalThis.File([blob], name, { type: mimeType });
  const nav = globalThis.navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav?.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function pickTextFile(): Promise<{ name: string; text: string } | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.length) return null;
  const a = r.assets[0];
  const text = Platform.OS === 'web' ? await (a.file ? a.file.text() : fetch(a.uri).then((r) => r.text())) : await new File(a.uri).text();
  return { name: a.name, text };
}

// ───────── Программа ─────────

export async function shareProgram(p: Program) {
  const header = '# Программа для приложения Pero. Формат: docs/program-format.md\n';
  const name = `${p.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'program'}.yaml`;
  await share(name, header + serializeProgram(p), 'text/yaml');
}

// ───────── Бэкап ─────────

export async function shareBackup() {
  await share(`pero-backup-${stamp()}.json`, JSON.stringify(dumpAll()), 'application/json');
}

export async function importBackup(): Promise<boolean> {
  const f = await pickTextFile();
  if (!f) return false;
  let data: Backup;
  try {
    data = JSON.parse(f.text);
  } catch {
    throw new Error('Файл не похож на бэкап Pero');
  }
  restoreAll(data);
  return true;
}

// ───────── Excel ─────────

const date = (ms: number) => new Date(ms);
const mins = (ms: number) => Math.round(ms / 60000);
const r1 = (n: number) => Math.round(n * 10) / 10;

function sheet(rows: Record<string, unknown>[], widths: number[]) {
  const ws = XLSX.utils.json_to_sheet(rows, { cellDates: true, dateNF: 'dd.mm.yyyy hh:mm' } as XLSX.JSON2SheetOpts);
  ws['!cols'] = widths.map((w) => ({ wch: w }));
  if (rows.length) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: Object.keys(rows[0]).length - 1 } }) };
  return ws;
}

export async function exportExcel() {
  const program = getActiveProgram();
  const defs = defsFor(program);
  const sets = setsBetween(0);
  const sessions = listSessions(100000).reverse();
  const nameOf = (id: string) => defs.get(id)?.name ?? id;
  const variantOf = (ex: string, v: string | null) => defs.get(ex)?.variants?.find((x) => x.id === v)?.name ?? '';

  // 1. Все подходы — сырые данные для своего анализа
  const setRows = sets.map((s) => ({
    'Дата': date(s.startedAt),
    'Тренировка': s.workoutName,
    'Упражнение': nameOf(s.exerciseId),
    'Вариант': variantOf(s.exerciseId, s.variantId),
    'Подход': s.kind === 'warmup' ? 'Р' : s.setIndex + 1,
    'Тип': s.kind === 'warmup' ? 'разминка' : 'рабочий',
    'Сторона': s.side === 'left' ? 'левая' : s.side === 'right' ? 'правая' : '',
    'Вес, кг': s.weight ?? '',
    'Повторения': s.reps ?? '',
    'Время, с': s.durationS ?? '',
    'RIR': s.rir ?? '',
    'Расчётный 1ПМ': s.weight && s.reps ? r1(e1rm(s.weight, s.reps, s.rir ?? 0)) : '',
    'Тоннаж, кг': s.weight && s.reps ? r1(s.weight * s.reps) : '',
    'Отдых план, с': s.restPlannedS ?? '',
    'Отдых факт, с': s.restActualS ?? '',
  }));

  // 2. Тренировки
  const sessRows = sessions.map((s) => ({
    'Дата': date(s.startedAt),
    'Тренировка': s.workoutName,
    'Длительность, мин': s.finishedAt ? mins(s.finishedAt - s.startedAt) : '',
    'Упражнений': s.exercises,
    'Рабочих подходов': s.sets,
    'Тоннаж, кг': Math.round(s.tonnage),
    'Самочувствие (1–5)': s.mood ?? '',
    'Усталость (1–5)': s.fatigue ?? '',
    'Заметка': s.note ?? '',
  }));

  // 3. Лучший результат по упражнению на каждой тренировке — удобно строить графики
  const best = new Map<string, Record<string, unknown> & { _e: number }>();
  for (const s of sets) {
    if (s.kind !== 'work' || !s.weight || !s.reps) continue;
    const key = `${s.sessionId}|${s.exerciseId}|${s.variantId}`;
    const e = e1rm(s.weight, s.reps, s.rir ?? 0);
    const cur = best.get(key);
    const vol = s.weight * s.reps;
    if (!cur) {
      best.set(key, { _e: e, 'Дата': date(s.startedAt), 'Упражнение': nameOf(s.exerciseId), 'Вариант': variantOf(s.exerciseId, s.variantId), 'Лучший подход': `${s.weight}×${s.reps}`, 'Расчётный 1ПМ': r1(e), 'Макс. вес': s.weight, 'Подходов': 1, 'Тоннаж, кг': vol });
    } else {
      cur['Подходов'] = (cur['Подходов'] as number) + 1;
      cur['Тоннаж, кг'] = (cur['Тоннаж, кг'] as number) + vol;
      cur['Макс. вес'] = Math.max(cur['Макс. вес'] as number, s.weight);
      if (e > cur._e) Object.assign(cur, { _e: e, 'Лучший подход': `${s.weight}×${s.reps}`, 'Расчётный 1ПМ': r1(e) });
    }
  }
  const exRows = [...best.values()].map(({ _e, ...rest }) => rest);

  // 4. Подходы на мышцу по неделям
  const weekStart = (ms: number) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  };
  const weeks = new Map<number, typeof sets>();
  for (const s of sets) weeks.set(weekStart(s.startedAt), [...(weeks.get(weekStart(s.startedAt)) ?? []), s]);
  const volRows = [...weeks.entries()].sort((a, b) => a[0] - b[0]).map(([w, ss]) => {
    const m = setsPerMuscle(ss, defs);
    const row: Record<string, unknown> = { 'Неделя с': date(w) };
    for (const [k, ru] of Object.entries(MUSCLE_RU)) row[ru] = r1(m.get(k as never) ?? 0);
    return row;
  });

  // 5. Вес тела
  const bodyRows = listBody().map((b) => ({ 'Дата': new Date(b.date), 'Вес, кг': b.weight ?? '', 'Талия, см': b.waist ?? '', 'Грудь, см': b.chest ?? '', 'Бицепс, см': b.arm ?? '', 'Ягодицы, см': b.hips ?? '', 'Бедро, см': b.thigh ?? '', 'Заметка': b.note ?? '' }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(sessRows, [17, 16, 10, 8, 10, 10, 10, 10, 40]), 'Тренировки');
  XLSX.utils.book_append_sheet(wb, sheet(setRows, [17, 14, 34, 16, 7, 10, 8, 8, 10, 8, 5, 12, 10, 10, 10]), 'Подходы');
  XLSX.utils.book_append_sheet(wb, sheet(exRows, [17, 34, 16, 12, 12, 9, 9, 10]), 'Упражнения');
  XLSX.utils.book_append_sheet(wb, sheet(volRows, [12, ...Object.keys(MUSCLE_RU).map(() => 11)]), 'Объём по мышцам');
  XLSX.utils.book_append_sheet(wb, sheet(bodyRows, [12, 8, 9, 30]), 'Вес тела');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: true }) as ArrayBuffer;
  await share(`pero-${stamp()}.xlsx`, new Uint8Array(out), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

// ───────── Набор для нейросети ─────────

/** Один файл: инструкция по формату + вся библиотека упражнений. Его достаточно отправить нейросети. */
export async function shareAiKit() {
  const text = `${docs.format}\n\n---\n\n# Библиотека упражнений (exercises.yaml)\n\n\`\`\`yaml\n${docs.library}\`\`\`\n`;
  await share('pero-program-format.md', text, 'text/markdown');
}
