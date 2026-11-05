#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const {
  installPdfMarkdownRules,
  isChineseDocument,
  isPathInside,
  toFileUrl,
} = require('./export-pdf-rules.cjs');

const skillRoot = path.resolve(__dirname, '..');

function parseArgs(args) {
  const usage = [
    'Usage: node scripts/export-pdf.cjs <markdown-file-or-directory> [pdf-file-or-directory] [--force]',
    'A file defaults to a sibling .pdf; a directory defaults to <input>/pdf/ and preserves subdirectories.',
  ].join('\n');
  if (args.includes('--help') || args.includes('-h')) return { help: true, usage };
  const force = args.includes('--force');
  const positional = args.filter(arg => arg !== '--force');
  if (positional.length < 1 || positional.length > 2) {
    throw new Error('Provide a Markdown file or directory and optionally an output path.');
  }

  const input = path.resolve(positional[0]);
  if (!fs.existsSync(input)) throw new Error(`Input does not exist: ${input}`);
  const inputIsFile = fs.statSync(input).isFile();
  if (inputIsFile && path.extname(input).toLowerCase() !== '.md') throw new Error(`Input file must end in .md: ${input}`);
  if (!inputIsFile && !fs.statSync(input).isDirectory()) throw new Error(`Input must be a Markdown file or directory: ${input}`);

  const outputArg = positional[1] ? path.resolve(positional[1]) : null;
  let output;
  if (inputIsFile) {
    output = outputArg || input.replace(/\.md$/i, '.pdf');
    if (path.extname(output).toLowerCase() !== '.pdf') throw new Error(`Output for a Markdown file must end in .pdf: ${output}`);
    if (path.resolve(output) === input) throw new Error('Input and output paths must be different.');
  } else {
    output = outputArg || path.join(input, 'pdf');
    if (isPathInside(input, output) && path.resolve(input) === path.resolve(output)) {
      throw new Error('The PDF output directory cannot also be the Markdown input directory.');
    }
  }
  return { force, help: false, input, inputIsFile, output };
}

function listMarkdownFiles(root, excludedDirectory) {
  const files = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const item = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (excludedDirectory && isPathInside(excludedDirectory, item)) continue;
        walk(item);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        files.push(item);
      }
    }
  }
  walk(root);
  return files.sort();
}

function loadDependencies() {
  try {
    return {
      MarkdownIt: require('markdown-it'),
      puppeteer: require('puppeteer'),
    };
  } catch (error) {
    throw new Error(`Skill dependencies are missing. Run npm install --prefix "${skillRoot}".`, { cause: error });
  }
}

function findMermaidCli() {
  if (process.env.MERMAID_CLI) return process.env.MERMAID_CLI;
  const executable = process.platform === 'win32' ? 'mmdc.cmd' : 'mmdc';
  const localPath = path.join(skillRoot, 'node_modules', '.bin', executable);
  return fs.existsSync(localPath) ? localPath : executable;
}

function shouldSkip(sourceFile, outputFile, force, toolFiles) {
  if (force || !fs.existsSync(outputFile)) return false;
  const outputTime = fs.statSync(outputFile).mtimeMs;
  if (fs.statSync(sourceFile).mtimeMs > outputTime) return false;
  return toolFiles.every(file => fs.statSync(file).mtimeMs <= outputTime);
}

function validatePdf(filePath) {
  const pdf = fs.readFileSync(filePath);
  if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-')) || !pdf.includes(Buffer.from('%%EOF'))) {
    throw new Error(`Invalid PDF generated: ${filePath}`);
  }
  if (pdf.includes(Buffer.from('file://'))) throw new Error(`Local file URI found in PDF: ${filePath}`);
}

function replaceFile(tempFile, outputFile) {
  if (process.platform !== 'win32' || !fs.existsSync(outputFile)) {
    fs.renameSync(tempFile, outputFile);
    return;
  }
  const backupFile = `${outputFile}.backup-${process.pid}`;
  fs.renameSync(outputFile, backupFile);
  try {
    fs.renameSync(tempFile, outputFile);
    fs.rmSync(backupFile, { force: true });
  } catch (error) {
    fs.renameSync(backupFile, outputFile);
    throw error;
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

async function renderOne({ sourceFile, outputFile, relativePath, counts, browser, MarkdownIt, mermaidCli }) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  const tempDirectory = fs.mkdtempSync(path.join(path.dirname(outputFile), '.pdf-export-'));
  const tempPdf = path.join(tempDirectory, path.basename(outputFile));
  let diagramCount = 0;
  try {
    const sourceText = fs.readFileSync(sourceFile, 'utf8');
    const title = (sourceText.match(/^#\s+(.+)$/m) || [null, path.basename(sourceFile, '.md')])[1].trim();
    const chinese = isChineseDocument(relativePath, sourceFile);
    const language = chinese ? 'zh-Hans' : 'ja';
    const fontStack = chinese
      ? '"Noto Sans CJK SC", "Noto Sans CJK JP", sans-serif'
      : '"Noto Sans CJK JP", "Noto Sans CJK SC", sans-serif';
    const markdown = new MarkdownIt({ html: false, linkify: true });
    installPdfMarkdownRules(markdown, counts);
    const originalFence = markdown.renderer.rules.fence || ((tokens, index, options, env, self) => self.renderToken(tokens, index, options));
    markdown.renderer.rules.fence = (tokens, index, options, env, self) => {
      const token = tokens[index];
      if (token.info.trim().split(/\s+/)[0].toLowerCase() !== 'mermaid') return originalFence(tokens, index, options, env, self);
      const inputFile = path.join(tempDirectory, `diagram-${diagramCount}.mmd`);
      const svgFile = path.join(tempDirectory, `diagram-${diagramCount}.svg`);
      fs.writeFileSync(inputFile, token.content);
      const cliArgs = ['-i', inputFile, '-o', svgFile, '-t', 'neutral', '-b', 'transparent', '-q'];
      const browserConfig = {};
      const chromePath = process.env.CHROME_BIN || process.env.PUPPETEER_EXECUTABLE_PATH;
      if (chromePath) browserConfig.executablePath = chromePath;
      if (process.env.PUPPETEER_NO_SANDBOX === '1') browserConfig.args = ['--no-sandbox'];
      if (Object.keys(browserConfig).length) {
        const configFile = path.join(tempDirectory, `puppeteer-${diagramCount}.json`);
        fs.writeFileSync(configFile, JSON.stringify(browserConfig));
        cliArgs.push('-p', configFile);
      }
      const result = spawnSync(mermaidCli, cliArgs, {
        encoding: 'utf8',
        shell: process.platform === 'win32',
        windowsHide: true,
      });
      if (result.error || result.status !== 0 || !fs.existsSync(svgFile)) {
        throw new Error(`Mermaid rendering failed in ${relativePath}: ${result.stderr || result.error || result.stdout}`);
      }
      diagramCount += 1;
      counts.diagrams += 1;
      return `<figure class="mermaid">${fs.readFileSync(svgFile, 'utf8')}</figure>\n`;
    };

    const html = `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><base href="${toFileUrl(path.dirname(sourceFile), true)}"><style>
@page { size: A4; margin: 16mm 15mm 18mm; }
* { box-sizing: border-box; }
body { font-family: ${fontStack}; font-size: 10pt; line-height: 1.55; color: #202124; overflow-wrap: anywhere; }
h1,h2,h3,h4 { line-height: 1.3; break-after: avoid; }
h1 { font-size: 21pt; border-bottom: 1px solid #aaa; padding-bottom: .25em; }
h2 { font-size: 16pt; margin-top: 1.5em; }
h3 { font-size: 12pt; margin-top: 1.25em; }
p,ul,ol,table,pre,blockquote { margin: .65em 0; }
table { border-collapse: collapse; width: 100%; font-size: 9pt; break-inside: auto; }
th,td { border: 1px solid #888; padding: 4px 6px; vertical-align: top; }
th { background: #eef1f4; }
tr { break-inside: avoid; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #f4f5f6; padding: 8px; border: 1px solid #ddd; font-size: 8.5pt; }
code { font-family: "Noto Sans Mono CJK JP", monospace; font-size: .9em; }
blockquote { border-left: 3px solid #9aa; padding-left: 10px; color: #454545; }
img { max-width: 100%; max-height: 240mm; object-fit: contain; }
a { color: #135ea8; text-decoration: none; }
figure.mermaid { margin: 1em 0; text-align: center; break-inside: avoid; page-break-inside: avoid; }
figure.mermaid svg { max-width: 100%; height: auto; }
hr { border: 0; border-top: 1px solid #aaa; }
</style></head><body>${markdown.render(sourceText)}</body></html>`;
    const htmlFile = path.join(tempDirectory, 'document.html');
    fs.writeFileSync(htmlFile, html);
    const page = await browser.newPage();
    try {
      await page.goto(toFileUrl(htmlFile), { waitUntil: 'load' });
      await page.evaluate(async () => { await document.fonts.ready; });
      await page.pdf({ path: tempPdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
    } finally {
      await page.close();
    }
    validatePdf(tempPdf);
    replaceFile(tempPdf, outputFile);
    counts.generated += 1;
    console.log(`${relativePath} -> ${outputFile} (Mermaid: ${diagramCount})`);
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) {
    console.log(options.usage);
    return;
  }
  const { MarkdownIt, puppeteer } = loadDependencies();
  const mermaidCli = findMermaidCli();
  const toolFiles = [
    __filename,
    require.resolve('./export-pdf-rules.cjs'),
    path.join(skillRoot, 'package.json'),
    path.join(skillRoot, 'package-lock.json'),
  ];
  const sourceFiles = options.inputIsFile
    ? [options.input]
    : listMarkdownFiles(options.input, options.output);
  if (!sourceFiles.length) throw new Error(`No Markdown files found under ${options.input}`);

  const counts = { generated: 0, skipped: 0, diagrams: 0, statusLabels: 0, localLinks: 0 };
  const launchOptions = { headless: true };
  const chromePath = process.env.CHROME_BIN || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (chromePath) launchOptions.executablePath = chromePath;
  if (process.env.PUPPETEER_NO_SANDBOX === '1') launchOptions.args = ['--no-sandbox'];
  const browser = await puppeteer.launch(launchOptions);

  try {
    for (const sourceFile of sourceFiles) {
      const relativePath = options.inputIsFile ? path.basename(sourceFile) : path.relative(options.input, sourceFile);
      const outputFile = options.inputIsFile
        ? options.output
        : path.join(options.output, relativePath.replace(/\.md$/i, '.pdf'));
      if (shouldSkip(sourceFile, outputFile, options.force, toolFiles)) {
        counts.skipped += 1;
        continue;
      }
      await renderOne({ sourceFile, outputFile, relativePath, counts, browser, MarkdownIt, mermaidCli });
    }
  } finally {
    await browser.close();
  }
  console.log(`PDFs: ${counts.generated} generated, ${counts.skipped} unchanged; Mermaid: ${counts.diagrams}; status labels: ${counts.statusLabels}; local links omitted: ${counts.localLinks}.`);
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });

module.exports = { listMarkdownFiles, parseArgs, renderOne, shouldSkip, validatePdf };
