import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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

const runFile = join(dir, 'pull-shark-run.json');

/**
 * Checkpoint de una tirada larga de Pull Shark. Una ejecucion de 1024 PRs dura
 * mas de una hora y cruza al menos un reset de cuota: si se corta, hay que
 * poder retomarla sin repetir lo ya hecho.
 */
export async function readRun() {
  try {
    return JSON.parse(await readFile(runFile, 'utf8'));
  } catch {
    return null;
  }
}

export async function saveRun(state) {
  await mkdir(dir, { recursive: true });
  await writeFile(runFile, JSON.stringify({ ...state, at: new Date().toISOString() }, null, 2) + '\n');
}

export async function clearRun() {
  await rm(runFile, { force: true });
}
