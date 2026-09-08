import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, '.archivaments');
const file = join(dir, 'history.json');

const empty = { version: 1, events: [] };

/** Historial local de acciones ejecutadas, usado por `status`. */
export async function readHistory() {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return structuredClone(empty);
  }
}

export async function record(event) {
  const history = await readHistory();
  history.events.push({ at: new Date().toISOString(), ...event });
  await mkdir(dir, { recursive: true });
  await writeFile(file, JSON.stringify(history, null, 2) + '\n');
  return history;
}

export function countBy(history, achievement) {
  return history.events.filter((e) => e.achievement === achievement).length;
}
