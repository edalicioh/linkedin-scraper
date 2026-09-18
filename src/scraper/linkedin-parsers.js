const APPLICATION_TYPES = {
  EASY_APPLY: 'Easy Apply',
  EXTERNAL: 'Apply on company website'
};

/**
 * Converts a localized result count to an integer.
 *
 * LinkedIn renders thousands separators according to the browser locale, so
 * both 4,204 and 4.204 represent the same value. A decimal-looking value is
 * only treated as a decimal when it is not grouped in threes.
 *
 * @param {string|number|null} value
 * @returns {number|null}
 */
function normalizeResultsCount(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : null;
  }

  if (typeof value !== 'string') return null;

  const text = value.trim();
  if (!text) return null;

  const compactMatch = text.match(/([\d.,\s]+)\s*(k|mil|m|mi)?\b/i);
  if (!compactMatch) return null;

  const rawNumber = compactMatch[1].trim();
  if (!/\d/.test(rawNumber)) return null;
  const suffix = compactMatch[2]?.toLowerCase();
  const separators = rawNumber.match(/[.,\s]/g) || [];
  const groups = rawNumber.split(/[.,\s]+/);
  let number;

  if (separators.length === 0) {
    number = Number(rawNumber);
  } else if (groups.length > 1 && groups.slice(1).every(group => group.length === 3)) {
    number = Number(groups.join(''));
  } else {
    const decimalSeparator = rawNumber.lastIndexOf(',') > rawNumber.lastIndexOf('.') ? ',' : '.';
    const normalized = rawNumber
      .replace(decimalSeparator === ',' ? /\./g : /,/g, '')
      .replace(decimalSeparator, '.');
    number = Number(normalized);
  }

  if (!Number.isFinite(number) || number < 0) return null;
  if (suffix === 'k' || suffix === 'mil') return Math.round(number * 1000);
  if (suffix === 'm' || suffix === 'mi') return Math.round(number * 1000000);
  return Math.trunc(number);
}

/**
 * Maps localized application button text to the stable public values used by
 * the scraper while retaining the original text for diagnostics.
 *
 * @param {string|null|undefined} value
 * @returns {{ raw: string|null, normalized: string|null }}
 */
function parseApplicationType(value) {
  const raw = typeof value === 'string' ? value.trim() || null : null;
  if (!raw) return { raw: null, normalized: null };

  const comparable = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (comparable.includes('easy apply') || comparable.includes('candidatura simplificada')) {
    return { raw, normalized: APPLICATION_TYPES.EASY_APPLY };
  }

  if (
    comparable.includes('apply on company website') ||
    comparable.includes('company website') ||
    comparable.includes('site da empresa') ||
    comparable.includes('candidatar-se no site') ||
    comparable.includes('candidatura no site')
  ) {
    return { raw, normalized: APPLICATION_TYPES.EXTERNAL };
  }

  if (comparable === 'apply' || comparable === 'candidatar-se') {
    return { raw, normalized: APPLICATION_TYPES.EXTERNAL };
  }

  return { raw, normalized: raw };
}

/**
 * Backwards-compatible shorthand for callers that only need the normalized
 * value.
 *
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
function normalizeApplicationType(value) {
  return parseApplicationType(value).normalized;
}

module.exports = {
  APPLICATION_TYPES,
  normalizeResultsCount,
  parseApplicationType,
  normalizeApplicationType
};
