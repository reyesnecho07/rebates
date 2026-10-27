import fs from 'fs';
import path from 'path';

const SRC = path.resolve('src');
const CONFIG = path.join(SRC, 'config', 'appConfig');
const API_RE = /^[ \t]*const\s+API_BASE\s*=\s*'\/api'\s*;[ \t]*\r?\n/m;
const DB_RE = /^[ \t]*const\s+DB_NAME\s*=\s*'USER'\s*;[ \t]*\r?\n/m;

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|jsx)$/.test(e.name)) fix(p);
  }
}

function fix(file) {
  if (file.startsWith(CONFIG)) return;
  let text = fs.readFileSync(file, 'utf8');
  const names = [];
  if (API_RE.test(text)) { text = text.replace(API_RE, ''); names.push('API_BASE'); }
  if (DB_RE.test(text)) { text = text.replace(DB_RE, ''); names.push('DB_NAME'); }
  if (!names.length) return;

  let rel = path.relative(path.dirname(file), CONFIG).split(path.sep).join('/');
  if (!rel.startsWith('.')) rel = './' + rel;
  const importLine = `import { ${names.join(', ')} } from '${rel}';\n`;

  const imports = [...text.matchAll(/^import[\s\S]*?;[ \t]*\r?\n/gm)];
  if (imports.length) {
    const last = imports[imports.length - 1];
    const end = last.index + last[0].length;
    text = text.slice(0, end) + importLine + text.slice(end);
  } else {
    text = importLine + text;
  }

  fs.writeFileSync(file, text);
  console.log('updated', path.relative(process.cwd(), file), `(${names.join(', ')})`);
}

walk(SRC);