#!/usr/bin/env node
import { main } from '../src/cli.js';
import { log } from '../src/log.js';

try {
  process.exitCode = (await main(process.argv.slice(2))) ?? 0;
} catch (error) {
  log.plain('');
  if (error?.expected) {
    log.error(error.message);
  } else {
    log.error(`Error inesperado: ${error?.message ?? error}`);
    if (process.env.DEBUG) console.error(error);
  }
  process.exitCode = 1;
}
