// Генерирует src/ui/exercisePhotos.ts: статические require() фото упражнений (Metro требует литералы).
// Источник соответствий: scripts/exercise-photos.json, файлы в assets/exercises (480–520 px, jpg).
import fs from 'node:fs';
const map = JSON.parse(fs.readFileSync(new URL('./exercise-photos.json', import.meta.url)));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const lines = Object.entries(map).filter(([k]) => !k.startsWith('_')).map(([k, v]) => {
  const s = slug(v);
  for (const n of [0, 1]) if (!fs.existsSync(new URL(`../assets/exercises/${s}_${n}.jpg`, import.meta.url))) throw new Error(`нет файла ${s}_${n}.jpg`);
  return `  '${k}': [require('../../assets/exercises/${s}_0.jpg'), require('../../assets/exercises/${s}_1.jpg')],`;
});
fs.writeFileSync(new URL('../src/ui/exercisePhotos.ts', import.meta.url),
`// Сгенерировано scripts/gen-photos.mjs, руками не править.
// Фото: free-exercise-db (github.com/yuhonas/free-exercise-db, Unlicense). Кадры: начало и конец движения.
/* eslint-disable @typescript-eslint/no-require-imports */
import type { ImageSourcePropType } from 'react-native';

export const PHOTOS: Record<string, [ImageSourcePropType, ImageSourcePropType]> = {
${lines.join('\n')}
};

export function photosFor(exerciseId: string | undefined, variantId?: string | null) {
  if (!exerciseId) return null;
  return (variantId && PHOTOS[\`\${exerciseId}:\${variantId}\`]) || PHOTOS[exerciseId] || null;
}
`);
console.log('photos:', lines.length);
