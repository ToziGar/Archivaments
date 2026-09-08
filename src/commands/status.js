import { color, heading, log } from '../log.js';
import { nextTier, tierFor } from '../config.js';
import { readHistory } from '../state.js';

/**
 * Progreso real, consultado contra GitHub (no contra el historial local).
 * La API no expone los logros directamente, asi que medimos sus contadores:
 * PRs mergeadas para Pull Shark y estrellas maximas para Starstruck.
 */
export async function status(ctx) {
  const { gh } = ctx;
  const me = await gh.me();

  heading(`Progreso de ${me.login}`);

  const merged = await gh.search(`is:pr author:${me.login} is:merged`);
  const mergedCount = merged?.total_count ?? 0;
  line('Pull Shark', mergedCount, 'pull-shark', 'PRs mergeadas');

  const repos = await gh.listRepos();
  const best = Array.isArray(repos)
    ? repos.reduce((max, r) => (r.stargazers_count > (max?.stargazers_count ?? -1) ? r : max), null)
    : null;
  line('Starstruck', best?.stargazers_count ?? 0, 'starstruck', `estrellas (${best?.name ?? 'sin repos'})`);

  const closedFast = await gh.search(`is:issue author:${me.login} is:closed`);
  log.plain('');
  log.info(`Issues cerrados: ${closedFast?.total_count ?? 0} (Quickdraw solo necesita uno cerrado en <5 min)`);

  const history = await readHistory();
  if (history.events.length) {
    heading('Ejecutado desde este CLI');
    const grouped = new Map();
    for (const e of history.events) grouped.set(e.achievement, (grouped.get(e.achievement) ?? 0) + 1);
    for (const [name, count] of grouped) log.ok(`${name}: ${count} vez/veces`);
    log.plain(`  ${color.gray(`ultima: ${new Date(history.events.at(-1).at).toLocaleString()}`)}`);
  }

  log.plain('');
  log.warn('Si no ves nada en tu perfil, revisa "Show Achievements on my profile"');
  log.link('en', 'https://github.com/settings/profile');
  return 0;
}

function line(label, count, key, unit) {
  const current = tierFor(key, count);
  const next = nextTier(key, count);
  const badge = current ? color.green(current.toUpperCase()) : color.gray('sin nivel');
  const goal = next ? color.gray(`faltan ${next.missing} para ${next.name}`) : color.yellow('nivel maximo');
  log.plain(`${color.bold(label.padEnd(14))} ${String(count).padStart(5)} ${unit.padEnd(28)} ${badge}  ${goal}`);
}
