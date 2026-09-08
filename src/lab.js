import { log } from './log.js';

/** Sufijo unico para ramas y ficheros, evita colisiones entre ejecuciones. */
export function stamp() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Asegura que existe el repositorio sandbox publico y devuelve sus datos.
 * Recien creado con auto_init, la rama por defecto tarda un instante en
 * aparecer, asi que esperamos a que el ref sea consultable.
 */
export async function ensureRepo(gh, owner, name, { quiet = false } = {}) {
  const existing = await gh.repo(owner, name);

  if (existing) {
    if (existing.private) {
      const error = new Error(
        `El repositorio ${owner}/${name} es privado y los logros solo cuentan en repos publicos.\n` +
          `  Hazlo publico en https://github.com/${owner}/${name}/settings, o usa --repo con otro nombre.`,
      );
      error.expected = true;
      throw error;
    }
    if (!quiet) log.info(`Uso el repositorio existente ${owner}/${name}`);
    return existing;
  }

  log.step(`Creando repositorio publico ${owner}/${name}...`);
  const created = await gh.createRepo(name, 'Laboratorio para desbloquear logros de GitHub');

  if (created.__dryRun) {
    return { name, owner: { login: owner }, default_branch: 'main', html_url: `https://github.com/${owner}/${name}` };
  }

  // auto_init crea el commit inicial de forma asincrona: esperamos al ref.
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await gh.headSha(owner, name, created.default_branch);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  log.ok(`Repositorio creado: ${created.html_url}`);
  return created;
}

/**
 * Ciclo completo de una pull request: rama -> commit -> PR -> merge.
 *
 * Un solo ciclo alimenta tres logros a la vez: Pull Shark (PR mergeada),
 * YOLO (merge sin review) y, si pasas `coAuthors`, Pair Extraordinaire.
 *
 * Merge method por defecto: `merge`. Un squash reescribe el mensaje del commit
 * y puede perder los trailers `Co-authored-by`, que es justo lo que cuenta.
 */
export async function mergedPullRequest(gh, repo, options = {}) {
  const owner = repo.owner.login;
  const name = repo.name;
  const base = repo.default_branch || 'main';

  const id = options.id || stamp();
  const branch = options.branch || `archivaments/${id}`;
  const filePath = options.path || `lab/${id}.md`;
  const title = options.title || `Aporte automatizado ${id}`;
  const coAuthors = options.coAuthors || [];
  const mergeMethod = options.mergeMethod || 'merge';

  const commitMessage = [
    title,
    '',
    options.commitBody || 'Generado por el CLI de Archivaments.',
    ...(coAuthors.length ? ['', ...coAuthors] : []),
  ].join('\n');

  const content = options.content ||
    `# ${title}\n\nArchivo generado el ${new Date().toISOString()}.\n` +
      (coAuthors.length ? `\nCo-autores:\n${coAuthors.map((c) => `- ${c.replace('Co-authored-by: ', '')}`).join('\n')}\n` : '');

  const headSha = await gh.headSha(owner, name, base);
  await gh.createBranch(owner, name, branch, headSha);
  await gh.commitFile(owner, name, { path: filePath, content, message: commitMessage, branch });

  const pull = await gh.createPull(owner, name, {
    title,
    body: options.prBody || 'PR generada por el CLI de Archivaments.',
    head: branch,
    base,
  });

  // Merge inmediato y sin review: eso es exactamente lo que pide YOLO.
  await gh.mergePull(owner, name, pull.number, { method: mergeMethod });

  if (options.deleteBranch !== false) {
    await gh.deleteBranch(owner, name, branch).catch(() => {});
  }

  return {
    number: pull.number,
    url: pull.html_url,
    branch,
    coAuthored: coAuthors.length > 0,
  };
}
