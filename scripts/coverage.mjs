import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir) {
  const files = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const name of entries) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else if (name === 'coverage.json') files.push(path);
  }
  return files;
}

function rangesFor(entry) {
  return (entry.functions ?? [])
    .flatMap((fn) => fn.ranges)
    .map((range) => ({
      start: range.startOffset,
      end: range.endOffset,
      count: range.count,
    }));
}

function countLines(source, ranges) {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') starts.push(index + 1);
  }
  let covered = 0;
  let total = 0;
  for (let line = 0; line < starts.length; line += 1) {
    const from = starts[line];
    const to = line + 1 < starts.length ? starts[line + 1] : source.length;
    const text = source.slice(from, to);
    if (!text.trim() || /^\s*(\/\/|\/\*|\*)/.test(text)) continue;
    total += 1;
    const offset = from + (text.length - text.trimStart().length);
    let count = 0;
    for (const range of ranges) {
      if (offset >= range.start && offset < range.end) count = range.count;
    }
    if (count > 0) covered += 1;
  }
  return { covered, total };
}

export function lineCoverage(root, baseURL) {
  const byFile = new Map();
  for (const file of walk(join(root, 'test-results'))) {
    let entries;
    try {
      entries = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.url.startsWith(baseURL) || !entry.url.endsWith('.js')) continue;
      const name = new URL(entry.url).pathname.replace(/^\//, '');
      if (!['app.js', 'logic.js', 'reader.js', 'version.js'].includes(name)) continue;
      const current = byFile.get(name) ?? { source: entry.source, ranges: [] };
      current.ranges.push(...rangesFor(entry));
      byFile.set(name, current);
    }
  }
  let covered = 0;
  let total = 0;
  for (const { source, ranges } of byFile.values()) {
    const lines = countLines(source, ranges);
    covered += lines.covered;
    total += lines.total;
  }
  return total ? { coverage: Number(((covered / total) * 100).toFixed(2)), coveredLines: covered, totalLines: total } : null;
}
