import { heading, log } from '../log.js';

/** Crea (o reutiliza) el repositorio publico donde se generan los logros. */
export async function init(ctx) {
  heading('Preparando el laboratorio');
  const repo = await ctx.repo();
  log.link('repo', repo.html_url);
  log.plain('');
  log.info('Siguiente paso: archivaments all --with <usuario>');
  return 0;
}
