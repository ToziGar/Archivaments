import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nextTier, tierFor, tiers } from '../src/config.js';

describe('niveles de logros', () => {
  it('usa los umbrales publicados por GitHub', () => {
    assert.deepEqual(Object.values(tiers['pull-shark']), [2, 16, 128, 1024]);
    assert.deepEqual(Object.values(tiers['pair-extraordinaire']), [1, 10, 24, 48]);
    assert.deepEqual(Object.values(tiers['galaxy-brain']), [2, 8, 16, 32]);
    assert.deepEqual(Object.values(tiers.starstruck), [16, 128, 512, 4096]);
  });

  it('nombra los niveles como GitHub: base, bronce, plata, oro', () => {
    assert.deepEqual(Object.keys(tiers['pull-shark']), ['base', 'bronce', 'plata', 'oro']);
  });

  it('no asigna nivel por debajo del minimo', () => {
    assert.equal(tierFor('pull-shark', 0), null);
    assert.equal(tierFor('pull-shark', 1), null);
  });

  it('asigna el nivel mas alto alcanzado, no el primero', () => {
    assert.equal(tierFor('pull-shark', 2), 'base');
    assert.equal(tierFor('pull-shark', 15), 'base');
    assert.equal(tierFor('pull-shark', 16), 'bronce');
    assert.equal(tierFor('pull-shark', 1024), 'oro');
    assert.equal(tierFor('pull-shark', 99999), 'oro');
  });

  it('calcula cuanto falta para el siguiente nivel', () => {
    assert.deepEqual(nextTier('pull-shark', 0), { name: 'base', needed: 2, missing: 2 });
    assert.deepEqual(nextTier('pull-shark', 127), { name: 'plata', needed: 128, missing: 1 });
    assert.equal(nextTier('pull-shark', 1024), null, 'en el maximo no hay siguiente');
  });

  it('devuelve null para logros sin niveles', () => {
    assert.equal(tierFor('quickdraw', 1), null);
    assert.equal(nextTier('yolo', 1), null);
  });
});
