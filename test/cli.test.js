import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseArgs } from '../src/cli.js';

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
