import { heading, log } from '../log.js';
import { mergedPullRequest } from '../lab.js';
import { record } from '../state.js';

/**
 * YOLO: mergear una pull request sin ninguna review.
 * En un repo recien creado no hay reglas de proteccion de rama, asi que el
 * merge inmediato del propio autor cuenta directamente.
 */
export async function yolo(ctx) {
  heading('YOLO');
  const repo = await ctx.repo({ quiet: true });

  log.step('Creando rama, commit, PR y merge sin review...');
  const pr = await mergedPullRequest(ctx.gh, repo, {
    title: 'Merge directo sin revision',
    prBody: 'Se mergea sin esperar aprobaciones. Eso es exactamente lo que mide YOLO.',
    mergeMethod: ctx.mergeMethod,
  });

  if (!ctx.dryRun) await record({ achievement: 'yolo', url: pr.url });
  log.trophy('YOLO registrado');
  log.trophy('Pull Shark +1 (toda PR mergeada suma)');
  log.link('PR', pr.url);
  return 0;
}
