import { color, heading, log, progress } from '../log.js';
import { tiers } from '../config.js';
import { mergedPullRequest } from '../lab.js';
import { clearRun, readRun, record, saveRun } from '../state.js';

/** Cada PR son 4 escrituras mas la lectura del head: 5 peticiones. */
const REQUESTS_PER_PR = 5;
const CHECKPOINT_EVERY = 10;

/**
 * Pull Shark: pull requests tuyas que acaban mergeadas.
 * Niveles de GitHub: 2 (base) / 16 (bronce) / 128 (plata) / 1024 (oro).
 *
 * Una tirada hasta oro son ~5100 peticiones contra una cuota de 5000/hora, asi
 * que cruza al menos un reset. El cliente pausa y reanuda solo, y aqui
 * guardamos checkpoints para poder retomar si se corta la ejecucion.
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

  const repo = await ctx.repo({ quiet: true });
  const target = tier ? table[tier] : Number(ctx.flags.target) || null;

  let count;
  if (target) {
    // Pull Shark cuenta PRs de todos tus repos, no solo del sandbox, asi que
    // preguntamos cuantas llevas ya y generamos unicamente las que faltan.
    const existing = await currentMergedCount(ctx);
    count = Math.max(target - existing, 0);
    log.info(`Ya tienes ${color.bold(existing)} PRs mergeadas; el objetivo son ${color.bold(target)}.`);
    if (count === 0) {
      log.trophy('Objetivo ya cubierto, no hay nada que crear.');
      return 0;
    }
  } else {
    count = Number(ctx.flags.count) || 2;
  }

  if (!Number.isInteger(count) || count < 1) {
    const error = new Error('--count tiene que ser un entero positivo.');
    error.expected = true;
    throw error;
  }

  // Retomamos un checkpoint previo salvo que pidan empezar de cero.
  const signature = `${repo.owner.login}/${repo.name}:${count}`;
  const saved = ctx.flags.fresh || ctx.dryRun ? null : await readRun();
  let done = saved?.signature === signature ? saved.done : 0;
  if (done > 0) {
    log.info(`Retomo una tirada anterior: ${color.bold(done)}/${count} ya hechas.`);
  }

  reportPlan(ctx, count - done);

  const created = [];
  const failed = [];

  for (let i = done + 1; i <= count; i++) {
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

    done = i;
    if (!ctx.dryRun && (i % CHECKPOINT_EVERY === 0 || i === count)) {
      await saveRun({ signature, done, created: created.length, failed: failed.length });
    }
  }

  if (!ctx.dryRun) {
    if (created.length) {
      await record({ achievement: 'pull-shark', merged: created.length, urls: created.slice(-5).map((p) => p.url) });
    }
    if (failed.length === 0) await clearRun();
  }

  log.plain('');
  log.trophy(`${created.length} pull requests mergeadas`);
  if (created.length) log.link('ultima', created.at(-1).url);
  if (ctx.gh.quotaPauses) log.info(`Pausas por cuota de la API: ${ctx.gh.quotaPauses}`);

  if (failed.length) {
    log.warn(`${failed.length} fallaron. Vuelve a lanzar el comando para retomar desde el checkpoint.`);
    for (const f of failed.slice(0, 5)) log.plain(`  #${f.i}: ${f.message}`);
  }
  return failed.length && !created.length ? 1 : 0;
}

/** Cuantas PRs tuyas hay ya mergeadas, segun la API de busqueda. */
async function currentMergedCount(ctx) {
  const result = await ctx.gh.search(`is:pr author:${ctx.me.login} is:merged`);
  return result?.total_count ?? 0;
}

/** Estimacion honesta: el throttle manda, y la cuota mete pausas de hasta 1 h. */
function reportPlan(ctx, pending) {
  const secondsPerPr = (ctx.gh.throttleMs * 4) / 1000;
  const runMinutes = Math.ceil((pending * secondsPerPr) / 60);
  const requests = pending * REQUESTS_PER_PR;
  const quotaPauses = Math.max(Math.floor(requests / 5000), 0);

  log.info(`Voy a crear y mergear ${color.bold(pending)} pull requests (~${requests} peticiones).`);
  if (pending > 5) {
    let text = `Tiempo estimado: ~${runMinutes} min de trabajo`;
    if (quotaPauses > 0) {
      text += ` + hasta ${quotaPauses} pausa(s) de cuota de hasta 1 h cada una`;
    }
    log.info(text + '.');
  }
  if (quotaPauses > 0) {
    log.warn('La tirada supera la cuota de 5000 peticiones/hora: pausara y seguira sola.');
    log.plain(`  ${color.gray('Se guarda un checkpoint cada 10 PRs; si se corta, relanza el mismo comando.')}`);
  }
}
