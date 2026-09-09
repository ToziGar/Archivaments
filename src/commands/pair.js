import { color, heading, log } from '../log.js';
import { mergedPullRequest } from '../lab.js';
import { record } from '../state.js';

/**
 * Pair Extraordinaire: commits co-autorizados dentro de una PR mergeada.
 *
 * Dos detalles que hacen que la mayoria de intentos fallen:
 *  - el commit tiene que acabar en una PR *mergeada*, no basta un push a main;
 *  - el email del trailer debe ser el noreply real del co-autor
 *    (`<id>+<login>@users.noreply.github.com`), que resolvemos por API.
 */
export async function pair(ctx) {
  heading('Pair Extraordinaire');

  const logins = ctx.flags.with ? String(ctx.flags.with).split(',').map((s) => s.trim()).filter(Boolean) : [];
  if (logins.length === 0) {
    const error = new Error(
      'Necesito al menos un co-autor: archivaments pair --with <usuario-de-github>\n' +
        '  Puede ser una cuenta secundaria tuya o la de alguien que te lo permita.\n' +
        '  Debe ser una cuenta real: GitHub valida que el email noreply exista.',
    );
    error.expected = true;
    throw error;
  }

  const trailers = [];
  for (const login of logins) {
    const trailer = await ctx.gh.coAuthorTrailer(login);
    log.ok(`Co-autor resuelto: ${color.bold(login)}`);
    log.plain(`  ${color.gray(trailer)}`);
    trailers.push(trailer);
  }

  const repo = await ctx.repo({ quiet: true });

  log.step('Creando commit co-autorizado dentro de una PR...');
  const pr = await mergedPullRequest(ctx.gh, repo, {
    title: `Trabajo en pareja con ${logins.join(' y ')}`,
    commitBody: 'Commit con trailers Co-authored-by para Pair Extraordinaire.',
    prBody: `Commit co-autorizado con ${logins.map((l) => '@' + l).join(', ')}.`,
    coAuthors: trailers,
    mergeMethod: ctx.mergeMethod,
  });

  if (!ctx.dryRun) await record({ achievement: 'pair-extraordinaire', url: pr.url, coAuthors: logins });
  log.trophy('Pair Extraordinaire registrado');
  log.trophy('YOLO y Pull Shark +1 tambien (la PR se mergeo sin review)');
  log.link('PR', pr.url);
  return 0;
}
