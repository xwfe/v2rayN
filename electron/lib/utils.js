const path = require('node:path');

function mergeWithDefaults(defaultValue, currentValue) {
  if (Array.isArray(defaultValue)) {
    return Array.isArray(currentValue) ? currentValue : [...defaultValue];
  }

  if (defaultValue === null || typeof defaultValue !== 'object') {
    return currentValue === undefined ? defaultValue : currentValue;
  }

  if (currentValue === null || typeof currentValue !== 'object') {
    return currentValue === undefined ? { ...defaultValue } : currentValue;
  }

  const result = { ...defaultValue };
  const keys = new Set([
    ...Object.keys(defaultValue ?? {}),
    ...Object.keys(currentValue ?? {})
  ]);

  for (const key of keys) {
    if (Array.isArray(defaultValue?.[key])) {
      result[key] = Array.isArray(currentValue[key])
        ? currentValue[key]
        : [...defaultValue[key]];
      continue;
    }

    if (
      typeof defaultValue?.[key] === 'object' &&
      defaultValue?.[key] !== null &&
      typeof currentValue?.[key] === 'object' &&
      currentValue?.[key] !== null
    ) {
      result[key] = mergeWithDefaults(defaultValue[key], currentValue[key]);
      continue;
    }

    if (currentValue?.[key] !== undefined) {
      result[key] = currentValue[key];
    } else if (defaultValue?.[key] !== undefined) {
      result[key] = defaultValue[key];
    }
  }

  return result;
}

function normalizePath(inputPath) {
  if (!inputPath) {
    return '';
  }
  return path.normalize(inputPath);
}

module.exports = {
  mergeWithDefaults,
  normalizePath
};
