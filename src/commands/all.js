import { color, heading, log } from '../log.js';
import { quickdraw } from './quickdraw.js';
import { pair } from './pair.js';
import { yolo } from './yolo.js';
import { pullshark } from './pullshark.js';
import { guide } from './guide.js';

/**
 * Combo completo: todo lo que se puede automatizar, en orden.
 * Si pasas --with, incluye Pair Extraordinaire; si no, lo salta y avisa.
 */
export async function all(ctx) {
  heading('Combo completo');
  await ctx.repo();

  const results = [];

  await quickdraw(ctx);
  results.push('Quickdraw');

  if (ctx.flags.with) {
    await pair(ctx);
    results.push('Pair Extraordinaire');
  } else {
    log.plain('');
    log.warn('Salto Pair Extraordinaire: no me diste co-autor (--with <usuario>).');
  }

  await yolo(ctx);
  results.push('YOLO');

  // El nivel base de Pull Shark son 2 PRs mergeadas; pair y yolo ya aportan.
  const already = ctx.flags.with ? 2 : 1;
  const target = Number(ctx.flags.count) || 2;
  if (target > already) {
    ctx.flags.count = target - already;
    await pullshark(ctx);
  }
  results.push(`Pull Shark (${Math.max(target, already)} PRs)`);

  heading('Resumen');
  for (const item of results) log.trophy(item);
  log.plain('');
  log.info('Los logros tardan de unos minutos a unas horas en aparecer en tu perfil.');
  log.link('perfil', `https://github.com/${ctx.owner}`);
  log.plain('');
  log.plain(color.gray('Los que faltan necesitan intervencion humana:'));
  guide();
  return 0;
}
