'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { installPdfMarkdownRules, isChineseDocument, isExternalOrFragmentLink, isPathInside, replaceStatusLabels, toFileUrl } = require('../scripts/export-pdf-rules.cjs');
const { listMarkdownFiles, parseArgs, shouldSkip, validatePdf } = require('../scripts/export-pdf.cjs');

function markdownIt() {
  try {
    return require('markdown-it');
  } catch {
    return null;
  }
}

test('renders status labels and keeps only portable links', t => {
  const MarkdownIt = markdownIt();
  if (!MarkdownIt) return t.skip('Run npm install in the skill directory to install markdown-it');
  const counts = { statusLabels: 0, localLinks: 0 };
  const markdown = new MarkdownIt({ html: false });
  installPdfMarkdownRules(markdown, counts);
  const html = markdown.render('✅ PASS; ❌ FAIL; ✅ ready; ❌ blocked; ⚠️ conditional; ⚠ conditional.\n\n[doc](guide.md#setup) [site](https://example.com) [section](#details)');
  assert.match(html, /PASS; FAIL; \[PASS\] ready; \[FAIL\] blocked; \[COND\] conditional; \[COND\] conditional\./);
  assert.doesNotMatch(html, /\[PASS\] PASS|\[FAIL\] FAIL|⚠/);
  assert.match(html, /<span>doc<\/span>/);
  assert.match(html, /<a href="https:\/\/example\.com">site<\/a>/);
  assert.match(html, /<a href="#details">section<\/a>/);
  assert.equal(counts.statusLabels, 6);
  assert.equal(counts.localLinks, 1);
});

test('maps file and directory inputs to safe output paths', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-skill-args-'));
  try {
    const file = path.join(temp, 'guide.md');
    const dir = path.join(temp, 'docs');
    fs.mkdirSync(dir);
    fs.writeFileSync(file, '# guide');
    assert.equal(parseArgs([file]).output, path.join(temp, 'guide.pdf'));
    assert.equal(parseArgs([dir]).output, path.join(dir, 'pdf'));
    assert.equal(parseArgs([dir, path.join(temp, 'exports')]).output, path.join(temp, 'exports'));
    assert.equal(parseArgs([file, path.join(temp, 'custom.pdf')]).output, path.join(temp, 'custom.pdf'));
    assert.throws(() => parseArgs([file, path.join(temp, 'bad.txt')]), /must end in .pdf/);
    assert.equal(parseArgs(['--help']).help, true);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('path, link and language rules cover common boundaries', () => {
  assert.equal(isPathInside('/tmp/docs', '/tmp/docs/zh'), true);
  assert.equal(isPathInside('/tmp/docs', '/tmp/docs2'), false);
  assert.equal(isChineseDocument(path.join('nested', 'guide.md'), path.join('/tmp/docs', 'zh', 'nested', 'guide.md')), true);
  assert.equal(isExternalOrFragmentLink('https://example.com'), true);
  assert.equal(isExternalOrFragmentLink('#anchor'), true);
  assert.equal(isExternalOrFragmentLink('guide.md'), false);
  assert.match(toFileUrl('/tmp/a b/#guide.md'), /a%20b\/%23guide\.md$/);
});

test('directory listing excludes output files and freshness check honors force', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-skill-scan-'));
  try {
    const source = path.join(temp, 'docs');
    const output = path.join(source, 'pdf');
    const markdown = path.join(source, 'guide.md');
    const pdf = path.join(output, 'guide.pdf');
    const tool = path.join(temp, 'rules.cjs');
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(markdown, '# Guide');
    fs.writeFileSync(path.join(output, 'generated.md'), '# Not source');
    fs.writeFileSync(pdf, '%PDF-1.4\n%%EOF');
    fs.writeFileSync(tool, '');
    const old = new Date(Date.now() - 20_000);
    const current = new Date(Date.now() - 10_000);
    fs.utimesSync(markdown, old, old);
    fs.utimesSync(tool, old, old);
    fs.utimesSync(pdf, current, current);
    assert.deepEqual(listMarkdownFiles(source, output), [markdown]);
    assert.equal(shouldSkip(markdown, pdf, false, [tool]), true);
    assert.equal(shouldSkip(markdown, pdf, true, [tool]), false);
    assert.equal(shouldSkip(markdown, path.join(output, 'missing.pdf'), false, [tool]), false);
    const newer = new Date(Date.now());
    fs.utimesSync(tool, newer, newer);
    assert.equal(shouldSkip(markdown, pdf, false, [tool]), false);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('PDF validation rejects invalid files and local file URIs', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-skill-validate-'));
  try {
    const valid = path.join(temp, 'valid.pdf');
    const local = path.join(temp, 'local.pdf');
    const invalid = path.join(temp, 'invalid.pdf');
    fs.writeFileSync(valid, '%PDF-1.4\n%%EOF');
    fs.writeFileSync(local, '%PDF-1.4\n/file:///tmp/source.md\n%%EOF');
    fs.writeFileSync(invalid, 'not a PDF');
    assert.doesNotThrow(() => validatePdf(valid));
    assert.throws(() => validatePdf(local), /Local file URI/);
    assert.throws(() => validatePdf(invalid), /Invalid PDF/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
