import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { GitHub, GitHubError } from '../src/github.js';
import { get, mockFetch, on } from './helpers.js';

let mock;
afterEach(() => mock?.restore());

const client = (options = {}) => new GitHub({ token: 't0ken', throttleMs: 0, ...options });

describe('cliente de la API', () => {
  it('envia autenticacion y version de la API en cada peticion', async () => {
    let seen;
    const original = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      seen = options.headers;
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    };
    await client().get('/user');
    globalThis.fetch = original;

    assert.equal(seen.Authorization, 'Bearer t0ken');
    assert.equal(seen['X-GitHub-Api-Version'], '2022-11-28');
  });

  it('devuelve null en 404 cuando se permite explicitamente', async () => {
    mock = mockFetch([[get(/.*/), () => [404, { message: 'Not Found' }]]]);
    assert.equal(await client().get('/repos/x/y', { allow404: true }), null);
  });

  it('lanza error legible si el token no vale', async () => {
    mock = mockFetch([[get(/.*/), () => [401, { message: 'Bad credentials' }]]]);
    await assert.rejects(client().get('/user'), (error) => {
      assert.ok(error instanceof GitHubError);
      assert.match(error.message, /Token invalido o caducado/);
      return true;
    });
  });

  it('explica que falta el scope repo ante un 403 de permisos', async () => {
    mock = mockFetch([[on('POST', /.*/), () => [403, { message: 'Resource not accessible by personal access token' }]]]);
    await assert.rejects(client().post('/user/repos', {}), /scope "repo"/);
  });

  it('detalla los errores de validacion de un 422', async () => {
    mock = mockFetch([[on('POST', /.*/), () => [422, {
      message: 'Validation Failed',
      errors: [{ message: 'Reference already exists' }],
    }]]]);
    await assert.rejects(client().post('/x', {}), /Reference already exists/);
  });

  it('espacia las escrituras segun el throttle configurado', async () => {
    mock = mockFetch([[on('POST', /.*/), () => [201, {}]]]);
    const gh = client({ throttleMs: 120 });

    const started = Date.now();
    await gh.post('/a', {});
    await gh.post('/b', {});
    await gh.post('/c', {});

    assert.ok(Date.now() - started >= 240, 'dos esperas de 120 ms entre tres escrituras');
  });

  it('no espacia las lecturas', async () => {
    mock = mockFetch([[get(/.*/), () => [200, {}]]]);
    const gh = client({ throttleMs: 500 });

    const started = Date.now();
    await gh.get('/a');
    await gh.get('/b');

    assert.ok(Date.now() - started < 300, 'los GET no pagan el throttle');
  });

  it('en dry-run no llega a hacer la peticion', async () => {
    mock = mockFetch([[on('POST', /.*/), () => { throw new Error('no deberia llamarse'); }]]);
    const result = await client({ dryRun: true }).post('/user/repos', { name: 'x' });

    assert.equal(result.__dryRun, true);
    assert.equal(mock.calls.length, 0);
  });

  it('espera al reset y reintenta cuando se agota la cuota', async () => {
    let attempts = 0;
    mock = mockFetch([[on('POST', /.*/), () => {
      attempts++;
      if (attempts === 1) {
        return {
          status: 403,
          body: { message: 'API rate limit exceeded' },
          headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000)) },
        };
      }
      return [201, { ok: true }];
    }]]);

    const gh = client({ quotaBufferMs: 0 });
    const result = await gh.post('/x', {});

    assert.equal(attempts, 2, 'reintenta tras la pausa');
    assert.equal(result.ok, true);
    assert.equal(gh.quotaPauses, 1);
  });

  it('con waitOnQuota desactivado falla en vez de esperar', async () => {
    mock = mockFetch([[on('POST', /.*/), () => ({
      status: 403,
      body: { message: 'API rate limit exceeded' },
      headers: { 'x-ratelimit-remaining': '0' },
    })]]);

    await assert.rejects(client({ waitOnQuota: false }).post('/x', {}), /Se agoto tu cuota/);
  });

  it('respeta Retry-After ante el limite secundario', async () => {
    let attempts = 0;
    mock = mockFetch([[on('POST', /.*/), () => {
      attempts++;
      if (attempts === 1) {
        return { status: 403, body: { message: 'You have exceeded a secondary rate limit' }, headers: { 'retry-after': '0' } };
      }
      return [201, {}];
    }]]);

    await client().post('/x', {});
    assert.equal(attempts, 2);
  });
});

describe('trailer de co-autor', () => {
  it('usa el email noreply real derivado del id de la cuenta', async () => {
    mock = mockFetch([[get(/^\/users\/munalex$/), () => [200, { login: 'Munalex', id: 24856713, name: 'Crash' }]]]);

    const trailer = await client().coAuthorTrailer('munalex');
    assert.equal(trailer, 'Co-authored-by: Crash <24856713+Munalex@users.noreply.github.com>');
  });

  it('cae al login cuando la cuenta no tiene nombre publico', async () => {
    mock = mockFetch([[get(/^\/users\//), () => [200, { login: 'anon', id: 7, name: null }]]]);

    assert.equal(await client().coAuthorTrailer('anon'), 'Co-authored-by: anon <7+anon@users.noreply.github.com>');
  });
});

describe('cabecera Retry-After', () => {
  it('usa 60 s por defecto cuando GitHub no manda la cabecera', async () => {
    const gh = new GitHub({ token: 't', throttleMs: 0 });
    const original = globalThis.fetch;
    let waited = null;
    globalThis.fetch = async () => new Response(JSON.stringify({ message: 'secondary rate limit' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
    // Interceptamos la espera para no dormir de verdad en el test.
    const timeout = globalThis.setTimeout;
    globalThis.setTimeout = (fn, ms) => { waited ??= ms; return timeout(fn, 0); };
    await gh.post('/x', {}, { retries: 1 }).catch(() => {});
    globalThis.setTimeout = timeout;
    globalThis.fetch = original;

    assert.equal(waited, 60_000);
  });
});
