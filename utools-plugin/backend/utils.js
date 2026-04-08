const path = require('path');

function parseArgsLine(line = '') {
  if (!line || typeof line !== 'string') {
    return [];
  }
  const tokens = line.match(/"[^"]*"|'[^']*'|\S+/g) || [];
  return tokens.map((token) => token.replace(/^"|"$/g, '').replace(/^'|'$/g, ''));
}

function formatArgs(args = []) {
  if (!Array.isArray(args)) {
    return '';
  }
  return args
    .map((arg) => {
      if (arg === undefined || arg === null) {
        return '';
      }
      const str = `${arg}`;
      if (/\s/.test(str)) {
        return `"${str.replace(/"/g, '\\"')}"`;
      }
      return str;
    })
    .filter(Boolean)
    .join(' ')
    .trim();
}

function resolvePath(root, candidate) {
  if (!candidate) {
    return null;
  }
  if (path.isAbsolute(candidate)) {
    return candidate;
  }
  return path.resolve(root, candidate);
}

function compactObject(obj) {
  const result = {};
  Object.entries(obj || {}).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }
    if (typeof value === 'string' && value.trim() === '') {
      return;
    }
    result[key] = value;
  });
  return result;
}

module.exports = {
  parseArgsLine,
  formatArgs,
  resolvePath,
  compactObject
};
