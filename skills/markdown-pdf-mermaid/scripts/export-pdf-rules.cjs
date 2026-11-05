'use strict';

const path = require('node:path');
const { pathToFileURL } = require('node:url');

const STATUS_REPLACEMENTS = [
  [/✅\s*PASS\b/gu, 'PASS'],
  [/❌\s*FAIL\b/gu, 'FAIL'],
  [/✅/gu, '[PASS]'],
  [/❌/gu, '[FAIL]'],
  [/\u26A0\uFE0F?/gu, '[COND]'],
];

function replaceStatusLabels(text) {
  const count = (text.match(/✅|❌|\u26A0\uFE0F?/gu) || []).length;
  let normalized = text;
  for (const [pattern, replacement] of STATUS_REPLACEMENTS) normalized = normalized.replace(pattern, replacement);
  return { text: normalized, count };
}

function isExternalOrFragmentLink(href) {
  return /^(?:https?:|mailto:|tel:|#)/i.test(href);
}

function installPdfMarkdownRules(markdown, counts = { statusLabels: 0, localLinks: 0 }) {
  markdown.core.ruler.after('inline', 'pdf-output-adjustments', state => {
    for (const block of state.tokens) {
      if (block.type !== 'inline' || !block.children) continue;
      const linkStack = [];
      for (const token of block.children) {
        if (token.type === 'text') {
          const result = replaceStatusLabels(token.content);
          token.content = result.text;
          counts.statusLabels += result.count;
        } else if (token.type === 'link_open') {
          const textOnly = !isExternalOrFragmentLink(token.attrGet('href') || '');
          linkStack.push(textOnly);
          if (textOnly) {
            counts.localLinks += 1;
            token.meta = { ...token.meta, pdfTextOnly: true };
          }
        } else if (token.type === 'link_close' && linkStack.pop()) {
          token.meta = { ...token.meta, pdfTextOnly: true };
        }
      }
    }
  });

  const renderOpen = markdown.renderer.rules.link_open || ((tokens, index, options, env, self) => self.renderToken(tokens, index, options));
  const renderClose = markdown.renderer.rules.link_close || ((tokens, index, options, env, self) => self.renderToken(tokens, index, options));
  markdown.renderer.rules.link_open = (tokens, index, options, env, self) => tokens[index].meta?.pdfTextOnly ? '<span>' : renderOpen(tokens, index, options, env, self);
  markdown.renderer.rules.link_close = (tokens, index, options, env, self) => tokens[index].meta?.pdfTextOnly ? '</span>' : renderClose(tokens, index, options, env, self);
  return counts;
}

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function toFileUrl(filePath, directory = false) {
  const absolutePath = path.resolve(filePath);
  return pathToFileURL(directory ? `${absolutePath}${path.sep}` : absolutePath).href;
}

function isChineseDocument(relativePath, sourceFile) {
  const pathParts = `${sourceFile}${path.sep}${relativePath}`.split(/[\\/]/).map(part => part.toLowerCase());
  return pathParts.includes('zh') || /_zh\.md$/i.test(relativePath);
}

module.exports = {
  installPdfMarkdownRules,
  isChineseDocument,
  isExternalOrFragmentLink,
  isPathInside,
  replaceStatusLabels,
  toFileUrl,
};
