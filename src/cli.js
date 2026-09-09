import { createInterface } from 'node:readline/promises';
import { defaults, resolveToken } from './config.js';
import { GitHub } from './github.js';
import { ensureRepo } from './lab.js';
import { color, log } from './log.js';

import { all } from './commands/all.js';
import { doctor } from './commands/doctor.js';
import { guide } from './commands/guide.js';
import { init } from './commands/init.js';
import { pair } from './commands/pair.js';
import { pullshark } from './commands/pullshark.js';
import { quickdraw } from './commands/quickdraw.js';
import { status } from './commands/status.js';
import { yolo } from './commands/yolo.js';

const VERSION = '1.0.0';

const commands = {
  doctor: { run: doctor, mutates: false, help: 'Comprueba token, permisos y cuota' },
  init: { run: init, mutates: true, help: 'Crea el repositorio sandbox publico' },
  quickdraw: { run: quickdraw, mutates: true, help: 'Abre y cierra un issue en segundos' },
  pair: { run: pair, mutates: true, help: 'Commit co-autorizado dentro de una PR mergeada' },
  yolo: { run: yolo, mutates: true, help: 'Mergea una PR sin ninguna review' },
  'pull-shark': { run: pullshark, mutates: true, help: 'Genera y mergea N pull requests' },
  all: { run: all, mutates: true, help: 'Ejecuta todo lo automatizable de una vez' },
  status: { run: status, mutates: false, help: 'Progreso actual de cada logro' },
  guide: { run: guide, mutates: false, help: 'Logros que tienes que hacer a mano' },
};

const aliases = { pullshark: 'pull-shark', ps: 'pull-shark', shark: 'pull-shark' };

// Opciones que nunca llevan valor. Sin esta lista, `--verbose status` se traga
// el comando y lo guarda como valor de --verbose.
const BOOLEAN_FLAGS = new Set([
  'dry-run', 'dryRun', 'yes', 'y', 'verbose', 'no-color', 'fresh',
  'help', 'h', 'version', 'v',
]);

export function parseArgs(argv) {
  const flags = {};
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('-')) {
      positional.push(arg);
      continue;
    }
    const clean = arg.replace(/^--?/, '');
    const [key, inline] = clean.split('=');
    if (inline !== undefined) {
      flags[key] = inline;
    } else if (!BOOLEAN_FLAGS.has(key) && argv[i + 1] && !argv[i + 1].startsWith('-')) {
      flags[key] = argv[++i];
    } else {
      flags[key] = true;
    }
  }
  return { command: positional[0], flags };
}

function usage() {
  const rows = Object.entries(commands)
    .map(([name, meta]) => `  ${color.cyan(name.padEnd(12))} ${meta.help}`)
    .join('\n');

  return `
${color.bold('archivaments')} ${color.gray('v' + VERSION)} - desbloquea logros de GitHub en tu propio sandbox

${color.bold('USO')}
  archivaments <comando> [opciones]

${color.bold('COMANDOS')}
${rows}

${color.bold('OPCIONES')}
  --with <usuarios>    Co-autores para "pair" (separados por comas)
  --count <n>          Numero de PRs para "pull-shark"
  --target <n>         Objetivo total de PRs mergeadas; crea solo las que falten
  --tier <nivel>       base | bronce | plata | oro (equivale a --target)
  --fresh              Ignora el checkpoint de una tirada anterior
  --repo <nombre>      Repositorio sandbox (por defecto: ${defaults.repo})
  --owner <login>      Propietario (por defecto: el usuario del token)
  --merge-method <m>   merge | squash | rebase (por defecto: merge)
  --delay <ms>         Espera entre escrituras (por defecto: ${defaults.delayMs})
  --token <token>      Token de GitHub (mejor usa el archivo .env)
  --dry-run            Enseña lo que haria sin tocar tu cuenta
  --yes, -y            No pide confirmacion
  --verbose            Muestra cada llamada a la API
  --no-color           Sin colores
  -h, --help           Esta ayuda
  -v, --version        Version

${color.bold('EJEMPLOS')}
  ${color.gray('# ver que haria, sin tocar nada')}
  archivaments all --with mi-otra-cuenta --dry-run

  ${color.gray('# combo completo: Quickdraw + Pair + YOLO + Pull Shark base')}
  archivaments all --with mi-otra-cuenta

  ${color.gray('# subir Pull Shark a bronce (16 PRs mergeadas en total)')}
  archivaments pull-shark --tier bronce

  ${color.gray('# ir a por el oro: pausa y reanuda sola al agotar la cuota')}
  archivaments pull-shark --tier oro --yes
`;
}

async function confirm(question) {
  if (!process.stdin.isTTY) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${color.yellow('?')} ${question} ${color.gray('(s/N)')} `);
  rl.close();
  return /^(s|si|sí|y|yes)$/i.test(answer.trim());
}

export async function main(argv) {
  const { command, flags } = parseArgs(argv);

  if (flags.v || flags.version) {
    log.plain(VERSION);
    return 0;
  }
  // Pedir ayuda es un uso correcto y sale con 0; invocar sin comando es un
  // error de uso y sale con 1, que es lo que espera cualquier script.
  const wantsHelp = Boolean(flags.h || flags.help);
  if (wantsHelp || !command) {
    log.plain(usage());
    return wantsHelp ? 0 : 1;
  }

  const name = aliases[command] || command;
  const entry = commands[name];
  if (!entry) {
    log.error(`Comando desconocido: ${command}`);
    log.plain(`Prueba con: ${Object.keys(commands).join(', ')}`);
    return 1;
  }

  // "guide" es texto puro: no necesita token ni red.
  if (name === 'guide') return entry.run({ flags });

  const token = resolveToken(flags.token === true ? undefined : flags.token);
  const dryRun = Boolean(flags['dry-run'] || flags.dryRun);

  const gh = new GitHub({
    token,
    throttleMs: Number(flags.delay) || defaults.delayMs,
    dryRun,
    verbose: Boolean(flags.verbose),
  });

  const me = await gh.me();
  const owner = flags.owner || me.login;
  const repoName = flags.repo || defaults.repo;

  if (entry.mutates && !dryRun && !flags.yes && !flags.y) {
    log.warn(`Esto creara contenido PUBLICO en ${color.bold(`${owner}/${repoName}`)} como ${color.bold(me.login)}.`);
    const proceed = await confirm('¿Continuo?');
    if (!proceed) {
      log.info('Cancelado. Nada tocado.');
      return 0;
    }
  }

  if (dryRun) log.info(color.yellow('Modo dry-run: no se enviara ninguna escritura.'));

  const ctx = {
    gh,
    token,
    me,
    owner,
    repoName,
    flags,
    dryRun,
    mergeMethod: flags['merge-method'] || defaults.mergeMethod,
  };

  // El sandbox se resuelve una sola vez por ejecucion, aunque lo pidan varios
  // comandos encadenados desde "all".
  let repoPromise = null;
  ctx.repo = (options) => (repoPromise ??= ensureRepo(gh, owner, repoName, options));

  return entry.run(ctx);
}
