// Ускорение веб-версии: expo-sqlite на каждый синхронный запрос заново выделяет
// SharedArrayBuffer на 1 МБ. В Safari это очень медленно, интерфейс подвисает.
// Запросы с главного потока идут строго по очереди, так что буферы можно переиспользовать.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const f = new URL('../node_modules/expo-sqlite/web/WorkerChannel.ts', import.meta.url);
if (!existsSync(f)) process.exit(0);
let s = readFileSync(f, 'utf8');
if (s.includes('PERO_SHARED_SYNC_BUFFERS')) process.exit(0);
const old = `  const lockBuffer = new SharedArrayBuffer(4);
  const lock = new Int32Array(lockBuffer);
  const resultBuffer = new SharedArrayBuffer(1024 * 1024);
  const resultArray = new Uint8Array(resultBuffer);`;
if (!s.includes(old)) {
  console.warn('patch-sqlite-web: код expo-sqlite изменился, патч не применён');
  process.exit(0);
}
s = s.replace(old, `  // PERO_SHARED_SYNC_BUFFERS
  const g = globalThis as unknown as { __peroSync?: { lockBuffer: SharedArrayBuffer; resultBuffer: SharedArrayBuffer } };
  g.__peroSync ??= { lockBuffer: new SharedArrayBuffer(4), resultBuffer: new SharedArrayBuffer(1024 * 1024) };
  const { lockBuffer, resultBuffer } = g.__peroSync;
  const lock = new Int32Array(lockBuffer);
  const resultArray = new Uint8Array(resultBuffer);`);
writeFileSync(f, s);
console.log('patch-sqlite-web: буферы синхронных запросов переиспользуются');
