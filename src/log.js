const enabled = !process.env.NO_COLOR && !process.argv.includes('--no-color');

const paint = (code) => (text) => (enabled ? `\x1b[${code}m${text}\x1b[0m` : String(text));

export const color = {
  bold: paint(1),
  dim: paint(2),
  red: paint(31),
  green: paint(32),
  yellow: paint(33),
  blue: paint(34),
  magenta: paint(35),
  cyan: paint(36),
  gray: paint(90),
};

export const log = {
  plain: (msg = '') => console.log(msg),
  info: (msg) => console.log(`${color.blue('·')} ${msg}`),
  step: (msg) => console.log(`${color.cyan('→')} ${msg}`),
  ok: (msg) => console.log(`${color.green('✓')} ${msg}`),
  warn: (msg) => console.log(`${color.yellow('!')} ${msg}`),
  error: (msg) => console.error(`${color.red('✗')} ${msg}`),
  trophy: (msg) => console.log(`${color.yellow('🏆')} ${color.bold(msg)}`),
  link: (label, url) => console.log(`  ${color.gray(label)} ${color.cyan(url)}`),
};

export function heading(title) {
  console.log('');
  console.log(color.bold(title));
  console.log(color.gray('─'.repeat(Math.max(title.length, 12))));
}

/** Barra de progreso de una linea, para lotes largos de PRs. */
export function progress(done, total, label = '') {
  if (!process.stdout.isTTY) return;
  const width = 24;
  const filled = Math.round((done / total) * width);
  const bar = '█'.repeat(filled) + color.gray('░'.repeat(width - filled));
  process.stdout.write(`\r  ${bar} ${done}/${total} ${color.gray(label)}   `);
  if (done === total) process.stdout.write('\n');
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
