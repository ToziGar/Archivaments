import { color, heading, log } from '../log.js';

/** Logros que ningun script puede desbloquear por ti, y por que. */
export function guide() {
  heading('Logros que requieren accion humana');

  log.plain(`${color.bold('Public Sponsor')}  ${color.gray('- requiere un pago real')}`);
  log.plain('  Patrocina a alguien desde 1 $/mes y marca el patrocinio como publico.');
  log.link('busca a quien patrocinar en', 'https://github.com/sponsors/explore');
  log.plain('  Un script no puede (ni debe) mover tu dinero: hazlo tu desde la web.');
  log.plain('');

  log.plain(`${color.bold('Galaxy Brain')}  ${color.gray('- 2 / 8 / 16 / 32 respuestas aceptadas')}`);
  log.plain('  Otra persona tiene que marcar tu respuesta como solucion en Discussions.');
  log.plain('  No se puede automatizar sin spamear repos ajenos, que ademas te puede');
  log.plain('  costar el baneo. Responde de verdad en proyectos que ya uses.');
  log.link('discussions activas', 'https://github.com/discussions');
  log.plain('');

  log.plain(`${color.bold('Starstruck')}  ${color.gray('- 16 / 128 / 512 / 4096 estrellas')}`);
  log.plain('  Necesita estrellas de cuentas reales. Comprarlas o usar cuentas falsas');
  log.plain('  es motivo de suspension. Publica algo util y compartelo.');
  log.plain('');

  log.plain(`${color.bold('Arctic Code Vault')} y ${color.bold('Mars 2020')}  ${color.gray('- retirados')}`);
  log.plain('  El snapshot del Artico fue en febrero de 2020 y el de Marte se cerro.');
  log.plain('  Ya no se pueden conseguir por ninguna via.');
  log.plain('');

  log.warn('Sin esto no veras ninguno: activa "Show Achievements on my profile"');
  log.link('en', 'https://github.com/settings/profile');
  return 0;
}
