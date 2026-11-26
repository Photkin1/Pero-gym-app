// Собирает YAML-файлы библиотеки и программ в JSON, который импортирует приложение.
// Запускается автоматически перед start/android (npm run gen).
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'src', 'data');
mkdirSync(out, { recursive: true });

const library = parse(readFileSync(join(root, 'library', 'exercises.yaml'), 'utf8'));
writeFileSync(join(out, 'library.json'), JSON.stringify(library.exercises, null, 1));

const programs = readdirSync(join(root, 'programs'))
  .filter((f) => f.endsWith('.yaml'))
  .sort()
  .map((f) => ({ file: f, source: readFileSync(join(root, 'programs', f), 'utf8') }));
writeFileSync(join(out, 'programs.json'), JSON.stringify(programs, null, 1));

console.log(`library: ${library.exercises.length} упражнений, programs: ${programs.length}`);
