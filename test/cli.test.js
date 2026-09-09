import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { main, parseArgs } from '../src/cli.js';

describe('parseo de argumentos', () => {
  it('separa el comando de las opciones', () => {
    const { command, flags } = parseArgs(['pull-shark', '--count', '5']);
    assert.equal(command, 'pull-shark');
    assert.equal(flags.count, '5');
  });

  it('acepta la forma --clave=valor', () => {
    assert.equal(parseArgs(['pair', '--with=alguien']).flags.with, 'alguien');
  });

  it('trata las opciones sin valor como booleanas', () => {
    const { flags } = parseArgs(['all', '--dry-run', '--yes']);
    assert.equal(flags['dry-run'], true);
    assert.equal(flags.yes, true);
  });

  it('no se come el comando siguiente como valor de una opcion booleana', () => {
    const { command, flags } = parseArgs(['--verbose', 'status']);
    assert.equal(command, 'status', 'el comando debe sobrevivir a una opcion booleana previa');
    assert.equal(flags.verbose, true);
  });

  it('las opciones con valor siguen consumiendo el argumento siguiente', () => {
    const { command, flags } = parseArgs(['pull-shark', '--tier', 'oro']);
    assert.equal(command, 'pull-shark');
    assert.equal(flags.tier, 'oro');
  });

  it('soporta opciones cortas', () => {
    assert.equal(parseArgs(['yolo', '-y']).flags.y, true);
  });

  it('devuelve command undefined sin argumentos', () => {
    assert.equal(parseArgs([]).command, undefined);
  });
});

describe('codigos de salida', () => {
  const silently = async (fn) => {
    const log = console.log;
    console.log = () => {};
    try {
      return await fn();
    } finally {
      console.log = log;
    }
  };

  it('pedir ayuda sale con 0', async () => {
    assert.equal(await silently(() => main(['--help'])), 0);
    assert.equal(await silently(() => main(['-h'])), 0);
  });

  it('invocar sin comando sale con 1', async () => {
    assert.equal(await silently(() => main([])), 1);
  });

  it('--version sale con 0', async () => {
    assert.equal(await silently(() => main(['--version'])), 0);
  });

  it('un comando desconocido sale con 1', async () => {
    const error = console.error;
    console.error = () => {};
    try {
      assert.equal(await silently(() => main(['inventado'])), 1);
    } finally {
      console.error = error;
    }
  });
});
