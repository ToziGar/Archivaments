import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { GitHub } from '../src/github.js';
import { ensureRepo, mergedPullRequest, stamp } from '../src/lab.js';
import { get, mockFetch, pullRequestRoutes } from './helpers.js';

let mock;
afterEach(() => mock?.restore());

const client = () => new GitHub({ token: 't', throttleMs: 0 });
const repo = { name: 'lab', owner: { login: 'tester' }, default_branch: 'main' };

describe('ciclo de pull request', () => {
  it('sigue el orden rama -> commit -> PR -> merge -> borrar rama', async () => {
    mock = mockFetch(pullRequestRoutes());
    await mergedPullRequest(client(), repo);

    const sequence = mock.calls.map((c) => `${c.method} ${c.path.replace(/\/repos\/tester\/lab/, '')}`);
    assert.deepEqual(sequence.map((s) => s.split('/').slice(0, 3).join('/')), [
      'GET /git/ref',
      'POST /git/refs',
      'PUT /contents/lab',
      'POST /pulls',
      'PUT /pulls/1',
      'DELETE /git/refs',
    ]);
  });

  it('mergea con "merge" por defecto: un squash se lleva por delante los trailers', async () => {
    mock = mockFetch(pullRequestRoutes());
    await mergedPullRequest(client(), repo);

    const merge = mock.calls.find((c) => /\/merge$/.test(c.path));
    assert.equal(merge.body.merge_method, 'merge');
  });

  it('permite forzar otro metodo de merge', async () => {
    mock = mockFetch(pullRequestRoutes());
    await mergedPullRequest(client(), repo, { mergeMethod: 'squash' });

    assert.equal(mock.calls.find((c) => /\/merge$/.test(c.path)).body.merge_method, 'squash');
  });

  it('coloca los trailers de co-autor al final y tras una linea en blanco', async () => {
    mock = mockFetch(pullRequestRoutes());
    const trailer = 'Co-authored-by: Crash <24856713+Munalex@users.noreply.github.com>';
    await mergedPullRequest(client(), repo, { title: 'Trabajo en pareja', coAuthors: [trailer] });

    const message = mock.calls.find((c) => /\/contents\//.test(c.path)).body.message;
    const lines = message.split('\n');

    assert.equal(lines.at(-1), trailer, 'el trailer cierra el mensaje');
    assert.equal(lines.at(-2), '', 'va separado por una linea en blanco');
    assert.equal(lines[0], 'Trabajo en pareja');
  });

  it('sin co-autores no deja lineas en blanco de sobra al final', async () => {
    mock = mockFetch(pullRequestRoutes());
    await mergedPullRequest(client(), repo);

    const message = mock.calls.find((c) => /\/contents\//.test(c.path)).body.message;
    assert.ok(!message.endsWith('\n'), 'sin trailer el mensaje no acaba en salto');
    assert.ok(!/Co-authored-by/.test(message));
  });

  it('crea la rama desde el head de la rama por defecto', async () => {
    mock = mockFetch(pullRequestRoutes());
    await mergedPullRequest(client(), repo);

    const ref = mock.calls.find((c) => c.method === 'POST' && /\/git\/refs$/.test(c.path));
    assert.equal(ref.body.sha, 'basesha');
    assert.match(ref.body.ref, /^refs\/heads\/archivaments\//);
  });

  it('abre la PR contra la rama por defecto del repositorio', async () => {
    mock = mockFetch(pullRequestRoutes());
    await mergedPullRequest(client(), { ...repo, default_branch: 'develop' });

    const pull = mock.calls.find((c) => c.method === 'POST' && /\/pulls$/.test(c.path));
    assert.equal(pull.body.base, 'develop');
  });

  it('puede conservar la rama si se pide', async () => {
    mock = mockFetch(pullRequestRoutes());
    await mergedPullRequest(client(), repo, { deleteBranch: false });

    assert.ok(!mock.calls.some((c) => c.method === 'DELETE'));
  });

  it('devuelve numero y url de la PR mergeada', async () => {
    mock = mockFetch(pullRequestRoutes());
    const result = await mergedPullRequest(client(), repo, { coAuthors: ['Co-authored-by: X <x@y>'] });

    assert.equal(result.number, 1);
    assert.equal(result.coAuthored, true);
    assert.match(result.url, /\/pull\/1$/);
  });
});

describe('preparacion del sandbox', () => {
  it('reutiliza el repositorio si ya existe', async () => {
    mock = mockFetch(pullRequestRoutes());
    const result = await ensureRepo(client(), 'tester', 'lab', { quiet: true });

    assert.equal(result.name, 'lab');
    assert.ok(!mock.calls.some((c) => c.path === '/user/repos'), 'no vuelve a crearlo');
  });

  it('rechaza un repositorio privado porque los logros no contarian', async () => {
    mock = mockFetch([
      [get(/^\/repos\/[^/]+\/[^/]+$/), () => [200, { name: 'lab', owner: { login: 'tester' }, private: true }]],
    ]);

    await assert.rejects(ensureRepo(client(), 'tester', 'lab', { quiet: true }), /privado/);
  });

  it('crea el repositorio como publico cuando no existe', async () => {
    mock = mockFetch([
      [get(/^\/repos\/[^/]+\/[^/]+$/), () => [404, { message: 'Not Found' }]],
      [({ method, path }) => method === 'POST' && path === '/user/repos', () => [201, {
        name: 'lab', owner: { login: 'tester' }, default_branch: 'main', html_url: 'https://github.com/tester/lab',
      }]],
      [get(/\/git\/ref\/heads\//), () => [200, { object: { sha: 'x' } }]],
    ]);

    await ensureRepo(client(), 'tester', 'lab', { quiet: true });
    const created = mock.calls.find((c) => c.path === '/user/repos');

    assert.equal(created.body.private, false);
    assert.equal(created.body.auto_init, true);
  });
});

describe('identificadores', () => {
  it('genera sufijos distintos en llamadas consecutivas', () => {
    assert.notEqual(stamp(), stamp());
  });
});
