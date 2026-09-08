import { heading, log, sleep } from '../log.js';
import { record } from '../state.js';

/**
 * Quickdraw: cerrar un issue o PR antes de 5 minutos desde su creacion.
 * Abrimos el issue y lo cerramos unos segundos despues, con margen de sobra.
 */
export async function quickdraw(ctx) {
  heading('Quickdraw');
  const repo = await ctx.repo({ quiet: true });

  log.step('Abriendo issue...');
  const issue = await ctx.gh.createIssue(ctx.owner, ctx.repoName, {
    title: `Comprobacion rapida ${new Date().toISOString()}`,
    body: 'Issue de prueba: se cierra en segundos para registrar el logro Quickdraw.',
  });

  const pause = ctx.dryRun ? 0 : 4000;
  if (pause) {
    log.info('Espero unos segundos para que quede un evento realista...');
    await sleep(pause);
  }

  log.step(`Cerrando issue #${issue.number}...`);
  await ctx.gh.closeIssue(ctx.owner, ctx.repoName, issue.number);

  if (!ctx.dryRun) await record({ achievement: 'quickdraw', url: issue.html_url });
  log.trophy('Quickdraw registrado');
  log.link('issue', issue.html_url);
  return 0;
}
