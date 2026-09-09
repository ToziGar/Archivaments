/** Utilidades para simular la API de GitHub sin tocar la red. */

const RESET = () => String(Math.floor(Date.now() / 1000) + 3600);

/**
 * Instala un `fetch` falso y devuelve el registro de llamadas junto a una
 * funcion para restaurar el original.
 *
 * `routes` es una lista de [matcher, responder]. El matcher recibe
 * `{ method, path }`; el responder devuelve `[status, body]` o un objeto
 * `{ status, body, headers }`.
 */
export function mockFetch(routes) {
  const original = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    const path = String(url).replace('https://api.github.com', '');
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ method, path, body });

    for (const [matches, respond] of routes) {
      if (!matches({ method, path })) continue;
      const result = respond({ method, path, body, calls });
      const { status = 200, body: payload = {}, headers = {} } = Array.isArray(result)
        ? { status: result[0], body: result[1] }
        : result;

      return new Response(status === 204 ? null : JSON.stringify(payload), {
        status,
        headers: {
          'content-type': 'application/json',
          'x-ratelimit-remaining': '4999',
          'x-ratelimit-limit': '5000',
          'x-ratelimit-reset': RESET(),
          ...headers,
        },
      });
    }

    throw new Error(`Ruta sin mock: ${method} ${path}`);
  };

  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

export const get = (pattern) => ({ method, path }) => method === 'GET' && pattern.test(path);
export const on = (verb, pattern) => ({ method, path }) => method === verb && pattern.test(path);

/** Conjunto de rutas suficiente para un ciclo completo de pull request. */
export function pullRequestRoutes({ owner = 'tester', repo = 'lab' } = {}) {
  let prNumber = 0;
  return [
    [get(/^\/user$/), () => [200, { login: owner, id: 1, name: 'Tester' }]],
    [get(/^\/users\//), ({ path }) => [200, { login: path.split('/')[2], id: 4242, name: 'Compi' }]],
    [get(new RegExp(`^/repos/${owner}/${repo}$`)), () => [200, {
      name: repo, owner: { login: owner }, default_branch: 'main', private: false,
      html_url: `https://github.com/${owner}/${repo}`,
    }]],
    [get(/\/git\/ref\/heads\//), () => [200, { object: { sha: 'basesha' } }]],
    [on('POST', /\/git\/refs$/), ({ body }) => [201, { ref: body.ref }]],
    [on('PUT', /\/contents\//), () => [201, { commit: { sha: 'newsha' } }]],
    [on('POST', /\/pulls$/), () => {
      prNumber++;
      return [201, { number: prNumber, html_url: `https://github.com/${owner}/${repo}/pull/${prNumber}` }];
    }],
    [on('PUT', /\/pulls\/\d+\/merge$/), () => [200, { merged: true }]],
    [on('DELETE', /\/git\/refs\/heads\//), () => [204, null]],
  ];
}
