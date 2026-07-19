// 한·영 정합성 감사: 라우트, 번역 객체, JSON 데이터 쌍, 영어 문자열 순도.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

let failures = 0;
const check = (condition, message) => {
  console.log(`${condition ? '✅' : '❌'} ${message}`);
  if (!condition) failures++;
};

async function loadTsModule(file) {
  const source = readFileSync(file, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function compareShape(left, right, path = '') {
  const issues = [];
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return [`${path}: array type mismatch`];
    if (left.length !== right.length) issues.push(`${path}: array length ${left.length} != ${right.length}`);
    for (let i = 0; i < Math.min(left.length, right.length); i++) {
      issues.push(...compareShape(left[i], right[i], `${path}[${i}]`));
    }
    return issues;
  }
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
      if (!(key in left)) issues.push(`${path}.${key}: missing ko`);
      else if (!(key in right)) issues.push(`${path}.${key}: missing en`);
      else issues.push(...compareShape(left[key], right[key], path ? `${path}.${key}` : key));
    }
    return issues;
  }
  if (typeof left !== typeof right) issues.push(`${path}: type mismatch`);
  return issues;
}

function findHangul(value, path = '') {
  const issues = [];
  if (typeof value === 'string' && /[가-힣]/.test(value)) issues.push(path);
  else if (Array.isArray(value)) value.forEach((item, index) => issues.push(...findHangul(item, `${path}[${index}]`)));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) issues.push(...findHangul(item, path ? `${path}.${key}` : key));
  }
  return issues;
}

const pageFiles = walk('src/pages').filter((file) => file.endsWith('.astro'));
const koRoutes = pageFiles.filter((file) => file.startsWith('src/pages/ko/')).map((file) => file.replace('src/pages/ko/', ''));
const enRoutes = new Set(pageFiles.filter((file) => file.startsWith('src/pages/en/')).map((file) => file.replace('src/pages/en/', '')));
check(koRoutes.every((file) => enRoutes.has(file)) && enRoutes.size === koRoutes.length,
  `라우트 소스 쌍 일치 (${koRoutes.length} ko / ${enRoutes.size} en)`);

const { getContent } = await loadTsModule('src/i18n/content.ts');
const { ui } = await loadTsModule('src/i18n/ui.ts');
const contentIssues = compareShape(getContent('ko'), getContent('en'));
check(contentIssues.length === 0, `콘텐츠 키·배열 구조 일치${contentIssues.length ? `: ${contentIssues.join('; ')}` : ''}`);
const uiIssues = compareShape(ui.ko, ui.en);
check(uiIssues.length === 0, `UI 번역 키 일치${uiIssues.length ? `: ${uiIssues.join('; ')}` : ''}`);

const englishHangul = [
  ...findHangul(getContent('en'), 'content.en'),
  ...findHangul(ui.en, 'ui.en'),
];

for (const name of ['seminars', 'history', 'invitations', 'members']) {
  const rows = JSON.parse(readFileSync(`src/data/${name}.json`, 'utf8'));
  const ko = rows.filter((row) => row.lang === 'ko');
  const en = rows.filter((row) => row.lang === 'en');
  const canonicalId = (row) => row.id.replace(/-en$/, '');
  const enById = new Map(en.map((row) => [canonicalId(row), row]));
  const pairIssues = [];
  const invariantFields = ['slug', 'date', 'status', 'kind', 'order', 'category', 'tba', 'mapUrl', 'time', 'year'];
  const parallelArrays = ['bio', 'participants', 'paragraphs', 'program', 'closing', 'tags'];

  for (const koRow of ko) {
    const enRow = enById.get(canonicalId(koRow));
    if (!enRow) {
      pairIssues.push(`${koRow.id}: missing en`);
      continue;
    }
    for (const field of invariantFields) {
      if ((field in koRow || field in enRow) && JSON.stringify(koRow[field]) !== JSON.stringify(enRow[field])) {
        pairIssues.push(`${koRow.id}.${field}`);
      }
    }
    for (const field of parallelArrays) {
      if ((koRow[field]?.length ?? 0) !== (enRow[field]?.length ?? 0)) pairIssues.push(`${koRow.id}.${field}.length`);
    }
  }
  for (const enRow of en) {
    if (!ko.some((koRow) => canonicalId(koRow) === canonicalId(enRow))) pairIssues.push(`${enRow.id}: missing ko`);
  }

  check(pairIssues.length === 0, `${name} 데이터 쌍 일치 (${ko.length} ko / ${en.length} en)${pairIssues.length ? `: ${pairIssues.join(', ')}` : ''}`);
  englishHangul.push(...findHangul(en, `data.${name}.en`));
}

check(englishHangul.length === 0, `영문 데이터에 한글 없음${englishHangul.length ? `: ${englishHangul.join(', ')}` : ''}`);

console.log(`\n${failures ? `FAIL: ${failures} i18n audit(s)` : 'PASS: Korean/English sources are aligned'}`);
process.exit(failures ? 1 : 0);
