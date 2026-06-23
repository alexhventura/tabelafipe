/**
 * Converte arquivos UTF-16 LE acidentalmente salvos pelo editor de volta para UTF-8.
 * Uso: node scripts/tools/fix-utf8-src.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

const TARGET_DIRS = [
  path.join(ROOT, 'src'),
  path.join(ROOT, 'scripts', 'lib'),
  path.join(ROOT, 'scripts', 'tools'),
  path.join(ROOT, 'scripts', 'ssg'),
  path.join(ROOT, 'scripts', 'datasets'),
  path.join(ROOT, 'data', 'schemas'),
  path.join(ROOT, 'astro-ssg', 'src'),
];

const EXT = /\.(tsx?|jsx?|mjs|cjs|json|astro|yml|yaml|css)$/;

function isUtf16Le(buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return true;
  return buf.length >= 4 && buf[1] === 0 && buf[3] === 0;
}

function utf16LeToUtf8(buf) {
  const body = buf[0] === 0xff && buf[1] === 0xfe ? buf.slice(2) : buf;
  return body.toString('utf16le').replace(/^\uFEFF/, '');
}

function convertFile(p) {
  const b = fs.readFileSync(p);
  if (!isUtf16Le(b)) return false;
  fs.writeFileSync(p, utf16LeToUtf8(b), 'utf8');
  console.log('converted', path.relative(ROOT, p));
  return true;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) count += walk(p);
    else if (EXT.test(e.name) && convertFile(p)) count++;
  }
  return count;
}

let total = 0;
for (const dir of TARGET_DIRS) total += walk(dir);
console.log(total ? `done (${total} arquivo(s))` : 'done (nenhuma conversao necessaria)');
