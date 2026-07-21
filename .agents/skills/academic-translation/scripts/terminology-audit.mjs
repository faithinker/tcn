#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const roots = ['src/i18n', 'src/data'];
const extensions = new Set(['.ts', '.json']);

const rules = [
  {
    pattern: /\bTrans[- ]Cultural Network\b/gi,
    preferred: 'Transcultural Network',
    reason: 'official organization name',
  },
  {
    pattern: /\bSouth Korea\b/g,
    preferred: 'Republic of Korea',
    reason: 'formal TCN country style',
  },
  {
    pattern: /\bthe Association\b/g,
    preferred: 'the Network',
    reason: 'preferred shortened reference to TCN',
  },
  {
    pattern: /\binternational academic (?:collaboration|cooperation)\b/gi,
    preferred: 'international scholarly collaboration',
    reason: 'canonical public-facing phrase',
  },
  {
    pattern: /\binternational scholarly cooperation\b/gi,
    preferred: 'international scholarly collaboration',
    reason: 'canonical public-facing phrase',
  },
  {
    pattern: /\bAdvisers?\b/g,
    preferred: 'Advisor / Advisors',
    reason: 'TCN house spelling; official external titles are exempt',
  },
  {
    pattern: /\bFounding Ceremony\b/g,
    preferred: 'Founding Assembly when the passage describes adopting bylaws or taking governance action',
    reason: 'ceremony and constitutive assembly are distinct',
    contextual: true,
  },
];

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function lineNumber(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

const files = roots.flatMap(walk).filter((file) => extensions.has(extname(file)));
const findings = [];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    for (const match of source.matchAll(rule.pattern)) {
      findings.push({
        file,
        line: lineNumber(source, match.index),
        found: match[0],
        preferred: rule.preferred,
        reason: rule.reason,
        contextual: Boolean(rule.contextual),
      });
    }
  }
}

if (findings.length === 0) {
  console.log('PASS: no discouraged TCN terminology variants found');
  process.exit(0);
}

console.log(`ADVISORY: ${findings.length} terminology occurrence(s) require review`);
for (const finding of findings) {
  const label = finding.contextual ? 'REVIEW' : 'PREFER';
  console.log(`${finding.file}:${finding.line} ${label} "${finding.found}" -> ${finding.preferred} (${finding.reason})`);
}

console.log('\nThis audit is advisory. Official names and context-specific exceptions may override house style.');
