import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Carga .env sin dependencias externas. Las variables ya definidas ganan. */
function loadDotEnv() {
  let raw;
  try {
    raw = readFileSync(join(root, '.env'), 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i.exec(line);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if (/^(".*"|'.*')$/s.test(value)) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/** Ultimo recurso: reutiliza el token de la GitHub CLI si esta instalada. */
function tokenFromGhCli() {
  try {
    const out = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: process.platform === 'win32',
    });
    return out.trim() || null;
  } catch {
    return null;
  }
}

export function resolveToken(flagToken) {
  loadDotEnv();
  const token =
    flagToken ||
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    tokenFromGhCli();

  if (!token || token.startsWith('ghp_pon_aqui')) {
    const error = new Error(
      'No encuentro un token de GitHub.\n\n' +
        '  1. Crea uno en https://github.com/settings/tokens/new con el scope "repo"\n' +
        '  2. Copia .env.example a .env y pega el token en GITHUB_TOKEN\n' +
        '     (o exporta GITHUB_TOKEN, o pasa --token <token>)',
    );
    error.expected = true;
    throw error;
  }
  return token;
}

export const defaults = {
  repo: process.env.ARCHIVAMENTS_REPO || 'archivaments-lab',
  delayMs: Number(process.env.ARCHIVAMENTS_DELAY_MS || 1200),
  mergeMethod: 'merge',
};

/** Tiers reales publicados por GitHub para los logros con niveles. */
export const tiers = {
  'pull-shark': { bronce: 2, plata: 16, oro: 128, platino: 1024 },
  'pair-extraordinaire': { bronce: 1, plata: 10, oro: 24, platino: 48 },
  'galaxy-brain': { bronce: 2, plata: 8, oro: 16, platino: 32 },
  starstruck: { bronce: 16, plata: 128, oro: 512, platino: 4096 },
};

export function tierFor(achievement, count) {
  const table = tiers[achievement];
  if (!table) return null;
  let current = null;
  for (const [name, needed] of Object.entries(table)) {
    if (count >= needed) current = name;
  }
  return current;
}

export function nextTier(achievement, count) {
  const table = tiers[achievement];
  if (!table) return null;
  for (const [name, needed] of Object.entries(table)) {
    if (count < needed) return { name, needed, missing: needed - count };
  }
  return null;
}
