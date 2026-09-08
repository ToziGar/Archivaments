import { color, heading, log, progress } from '../log.js';
import { tiers } from '../config.js';
import { mergedPullRequest } from '../lab.js';
import { record } from '../state.js';

/**
 * Pull Shark: pull requests tuyas que acaban mergeadas.
 * Niveles reales de GitHub: 2 / 16 / 128 / 1024.
 *
 * El cuello de botella es el limite secundario de GitHub, no la API en si:
 * cada PR son 4 escrituras, asi que el cliente las espacia automaticamente.
 */
export async function pullshark(ctx) {
  heading('Pull Shark');

  const table = tiers['pull-shark'];
  const tier = ctx.flags.tier ? String(ctx.flags.tier).toLowerCase() : null;
  if (tier && !table[tier]) {
    const error = new Error(`Nivel desconocido "${tier}". Usa: ${Object.keys(table).join(', ')}`);
    error.expected = true;
    throw error;
  }

  const count = Number(ctx.flags.count) || (tier ? table[tier] : 2);
  if (!Number.isInteger(count) || count < 1) {
    const error = new Error('--count tiene que ser un entero positivo.');
    error.expected = true;
    throw error;
  }

  const perPr = (ctx.gh.throttleMs * 4) / 1000;
  log.info(`Voy a crear y mergear ${color.bold(count)} pull requests.`);
  if (count > 5) log.info(`Tiempo estimado: ~${Math.ceil((count * perPr) / 60)} min (limite secundario de GitHub).`);

  const repo = await ctx.repo({ quiet: true });

  const created = [];
  const failed = [];
  for (let i = 1; i <= count; i++) {
    try {
      const pr = await mergedPullRequest(ctx.gh, repo, {
        title: `Pull Shark ${i}/${count}`,
        mergeMethod: ctx.mergeMethod,
      });
      created.push(pr);
      progress(i, count, `PR #${pr.number}`);
    } catch (error) {
      failed.push({ i, message: error.message });
      progress(i, count, color.red('fallo'));
    }
  }

  if (!ctx.dryRun && created.length) {
    await record({ achievement: 'pull-shark', merged: created.length, urls: created.slice(-5).map((p) => p.url) });
  }

  log.plain('');
  log.trophy(`${created.length} pull requests mergeadas`);
  if (created.length) log.link('ultima', created.at(-1).url);

  if (failed.length) {
    log.warn(`${failed.length} fallaron:`);
    for (const f of failed.slice(0, 5)) log.plain(`  #${f.i}: ${f.message}`);
  }
  return failed.length && !created.length ? 1 : 0;
}
