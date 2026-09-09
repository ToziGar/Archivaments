import { log, sleep } from './log.js';

const API = 'https://api.github.com';
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class GitHubError extends Error {
  constructor(message, { status, body, path } = {}) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
    this.body = body;
    this.path = path;
    this.expected = true;
  }
}

/**
 * Cliente REST minimo para la API de GitHub.
 *
 * Resuelve las dos cosas que rompen los scripts de logros caseros: el limite
 * secundario de GitHub (~80 peticiones que crean contenido por minuto) y los
 * errores 422 mudos al crear ramas o PRs duplicadas.
 */
export class GitHub {
  #token;
  #lastMutation = 0;

  constructor({ token, throttleMs = 1200, dryRun = false, verbose = false, waitOnQuota = true, quotaBufferMs = 5000 }) {
    this.#token = token;
    this.throttleMs = throttleMs;
    this.dryRun = dryRun;
    this.verbose = verbose;
    // Tiradas largas (Pull Shark oro son ~5100 peticiones frente a una cuota de
    // 5000/hora) tienen que esperar al reset en vez de abortar a media faena.
    this.waitOnQuota = waitOnQuota;
    this.quotaBufferMs = quotaBufferMs;
    this.rateLimit = null;
    this.quotaPauses = 0;
  }

  /** Duerme hasta que GitHub reponga la cuota, con un margen de seguridad. */
  async #waitForQuota() {
    const resetAt = this.rateLimit?.resetAt ?? new Date(Date.now() + 60_000);
    const waitMs = Math.max(resetAt.getTime() - Date.now(), 0) + this.quotaBufferMs;
    this.quotaPauses++;
    log.warn(
      `Cuota de la API agotada. Reanudo a las ${resetAt.toLocaleTimeString()} ` +
        `(~${Math.ceil(waitMs / 60000)} min). Pausa ${this.quotaPauses}.`,
    );
    await sleep(waitMs);
  }

  async request(method, path, body, { retries = 3, allow404 = false } = {}) {
    if (this.dryRun && MUTATING.has(method)) {
      log.plain(`  ${method} ${path}`);
      return { __dryRun: true, number: 0, html_url: '(dry-run)' };
    }

    // Antes de escribir, si la cuota esta casi agotada esperamos al reset.
    // Es mas barato pausar aqui que comerse un 403 y reintentar.
    if (this.waitOnQuota && MUTATING.has(method) && this.rateLimit && this.rateLimit.remaining < 20) {
      await this.#waitForQuota();
      this.rateLimit = null;
    }

    // Espaciamos las escrituras para no chocar con el limite secundario.
    if (MUTATING.has(method) && this.throttleMs > 0) {
      const elapsed = Date.now() - this.#lastMutation;
      if (elapsed < this.throttleMs) await sleep(this.throttleMs - elapsed);
      this.#lastMutation = Date.now();
    }

    const response = await fetch(path.startsWith('http') ? path : API + path, {
      method,
      headers: {
        Authorization: `Bearer ${this.#token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'archivaments-cli',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const remaining = response.headers.get('x-ratelimit-remaining');
    if (remaining !== null) {
      this.rateLimit = {
        remaining: Number(remaining),
        limit: Number(response.headers.get('x-ratelimit-limit')),
        resetAt: new Date(Number(response.headers.get('x-ratelimit-reset')) * 1000),
      };
    }

    if (response.status === 204) return null;

    const text = await response.text();
    const data = text ? safeJson(text) : null;

    if (response.status === 404 && allow404) return null;

    if (response.ok) {
      if (this.verbose) log.plain(`  ${method} ${response.status} ${path}`);
      return data;
    }

    // Limite secundario / abuso: GitHub pide esperar y reintentar.
    // Ojo con Retry-After: 0 es un valor valido, asi que no vale un `||`.
    const retryAfterHeader = response.headers.get('retry-after');
    const retryAfter = retryAfterHeader === null ? null : Number(retryAfterHeader);
    const secondary =
      response.status === 429 || (response.status === 403 && /secondary rate/i.test(text));
    if (secondary && retries > 0) {
      const seconds = retryAfter !== null && Number.isFinite(retryAfter) ? retryAfter : 60;
      const waitMs = seconds * 1000;
      log.warn(`Limite secundario de GitHub. Espero ${Math.round(waitMs / 1000)}s y reintento...`);
      await sleep(waitMs);
      return this.request(method, path, body, { retries: retries - 1, allow404 });
    }

    // Red de seguridad: si aun asi llegamos al 403 por cuota, esperamos y
    // reintentamos en vez de tirar la ejecucion entera por la borda.
    if (response.status === 403 && this.rateLimit?.remaining === 0) {
      if (this.waitOnQuota && retries > 0) {
        await this.#waitForQuota();
        this.rateLimit = null;
        return this.request(method, path, body, { retries: retries - 1, allow404 });
      }
      throw new GitHubError(
        `Se agoto tu cuota de la API. Se restablece a las ${this.rateLimit.resetAt.toLocaleTimeString()}.`,
        { status: 403, body: data, path },
      );
    }

    throw new GitHubError(describe(response.status, data, path), {
      status: response.status,
      body: data,
      path,
    });
  }

  get = (path, opts) => this.request('GET', path, undefined, opts);
  post = (path, body, opts) => this.request('POST', path, body, opts);
  patch = (path, body, opts) => this.request('PATCH', path, body, opts);
  put = (path, body, opts) => this.request('PUT', path, body, opts);
  del = (path, opts) => this.request('DELETE', path, undefined, opts);

  // -- Usuarios ------------------------------------------------------------
  me() {
    return this.get('/user');
  }

  user(login) {
    return this.get(`/users/${encodeURIComponent(login)}`);
  }

  /**
   * Trailer con el email noreply oficial: `<id>+<login>@users.noreply.github.com`.
   * Usar el formato exacto es lo que hace que GitHub enlace el co-autor con una
   * cuenta real. Si el email no coincide, Pair Extraordinaire no cuenta.
   */
  async coAuthorTrailer(login) {
    const user = await this.user(login);
    const name = user.name || user.login;
    return `Co-authored-by: ${name} <${user.id}+${user.login}@users.noreply.github.com>`;
  }

  // -- Repositorios --------------------------------------------------------
  repo(owner, name) {
    return this.get(`/repos/${owner}/${name}`, { allow404: true });
  }

  createRepo(name, description) {
    return this.post('/user/repos', {
      name,
      description,
      private: false, // los logros solo cuentan en repos publicos
      auto_init: true,
      has_issues: true,
    });
  }

  listRepos() {
    return this.get('/user/repos?per_page=100&affiliation=owner&sort=updated');
  }

  // -- Git refs y contenidos ----------------------------------------------
  async headSha(owner, name, branch) {
    const ref = await this.get(`/repos/${owner}/${name}/git/ref/heads/${branch}`);
    return ref.object.sha;
  }

  createBranch(owner, name, branch, sha) {
    return this.post(`/repos/${owner}/${name}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha,
    });
  }

  deleteBranch(owner, name, branch) {
    return this.del(`/repos/${owner}/${name}/git/refs/heads/${branch}`, { allow404: true });
  }

  commitFile(owner, name, { path, content, message, branch }) {
    return this.put(`/repos/${owner}/${name}/contents/${path}`, {
      message,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch,
    });
  }

  // -- Issues y pull requests ---------------------------------------------
  createIssue(owner, name, { title, body }) {
    return this.post(`/repos/${owner}/${name}/issues`, { title, body });
  }

  closeIssue(owner, name, number, reason = 'completed') {
    return this.patch(`/repos/${owner}/${name}/issues/${number}`, {
      state: 'closed',
      state_reason: reason,
    });
  }

  createPull(owner, name, { title, body, head, base }) {
    return this.post(`/repos/${owner}/${name}/pulls`, { title, body, head, base });
  }

  mergePull(owner, name, number, { method = 'merge', title } = {}) {
    return this.put(`/repos/${owner}/${name}/pulls/${number}/merge`, {
      merge_method: method,
      ...(title ? { commit_title: title } : {}),
    });
  }

  search(query) {
    return this.get(`/search/issues?q=${encodeURIComponent(query)}&per_page=1`);
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function describe(status, data, path) {
  const base = data?.message || `Error HTTP ${status}`;
  const details = Array.isArray(data?.errors) && data.errors.length
    ? '\n  ' + data.errors.map((e) => e.message || `${e.field}: ${e.code}`).join('\n  ')
    : '';

  if (status === 401) {
    return 'Token invalido o caducado. Genera uno nuevo en https://github.com/settings/tokens';
  }
  if (status === 403 && /resource not accessible/i.test(base)) {
    return `Al token le falta permiso para ${path}.\n  Con un token clasico necesitas el scope "repo".`;
  }
  return details ? `${base}${details}` : `${base} (${status} en ${path})`;
}
