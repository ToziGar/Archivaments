import { color, heading, log } from '../log.js';

/** Verifica token, identidad, scopes y cuota antes de tocar nada. */
export async function doctor(ctx) {
  const { gh } = ctx;
  heading('Diagnostico');

  const me = await gh.me();
  log.ok(`Autenticado como ${color.bold(me.login)}${me.name ? ` (${me.name})` : ''}`);
  log.plain(`  Repos publicos: ${me.public_repos}   Seguidores: ${me.followers}`);

  const probe = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${ctx.token}`, 'User-Agent': 'archivaments-cli' },
  });
  const scopes = (probe.headers.get('x-oauth-scopes') || '').split(',').map((s) => s.trim()).filter(Boolean);

  if (scopes.length === 0) {
    log.info('Token de tipo fine-grained (sin lista de scopes clasica).');
    log.plain(`  ${color.gray('Necesita permisos de lectura y escritura en Contents, Issues, Pull requests y Administration.')}`);
  } else if (scopes.includes('repo') || scopes.includes('public_repo')) {
    log.ok(`Scopes correctos: ${scopes.join(', ')}`);
  } else {
    log.error(`Faltan permisos. Scopes actuales: ${scopes.join(', ') || 'ninguno'}`);
    log.plain(`  ${color.gray('Genera un token con el scope "repo" en https://github.com/settings/tokens/new')}`);
  }

  if (gh.rateLimit) {
    log.info(`Cuota API: ${gh.rateLimit.remaining}/${gh.rateLimit.limit} (reset ${gh.rateLimit.resetAt.toLocaleTimeString()})`);
  }

  const repo = await gh.repo(me.login, ctx.repoName);
  if (!repo) {
    log.info(`El sandbox ${me.login}/${ctx.repoName} aun no existe. Se creara con "init" o "all".`);
  } else if (repo.private) {
    log.error(`${repo.full_name} es privado: los logros NO cuentan. Hazlo publico.`);
  } else {
    log.ok(`Sandbox listo: ${repo.html_url}`);
  }

  log.plain('');
  log.warn('Recuerda activar la casilla "Show Achievements on my profile"');
  log.link('en', 'https://github.com/settings/profile');
  return 0;
}
