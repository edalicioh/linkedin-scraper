const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

class JobQueryValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'JobQueryValidationError';
    this.code = 'INVALID_QUERY';
    this.statusCode = 400;
  }
}

function queryValue(value, name) {
  if (
    Array.isArray(value) ||
    value === null ||
    (typeof value !== 'string' && typeof value !== 'number') ||
    (typeof value === 'number' && !Number.isFinite(value))
  ) {
    throw new JobQueryValidationError(`Query parameter "${name}" must have one value.`);
  }

  return value;
}

function parsePositiveInteger(value, name, fallback, maximum) {
  if (value === undefined) {
    return fallback;
  }

  value = queryValue(value, name);
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) {
    throw new JobQueryValidationError(`Query parameter "${name}" must be a positive integer.`);
  }

  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new JobQueryValidationError(`Query parameter "${name}" must be a positive integer.`);
  }

  if (maximum !== undefined && parsed > maximum) {
    throw new JobQueryValidationError(`Query parameter "${name}" cannot exceed ${maximum}.`);
  }

  return parsed;
}

function parseOptionalText(value, name) {
  if (value === undefined) {
    return undefined;
  }

  value = queryValue(value, name);
  const text = String(value).trim();
  return text || undefined;
}

function parseJobQuery(query = {}) {
  if (query === null || typeof query !== 'object' || Array.isArray(query)) {
    throw new JobQueryValidationError('Query parameters must be an object.');
  }

  const normalized = {
    page: parsePositiveInteger(query.page, 'page', DEFAULT_PAGE),
    limit: parsePositiveInteger(query.limit, 'limit', DEFAULT_LIMIT, MAX_LIMIT),
    search: parseOptionalText(query.search, 'search'),
    type: parseOptionalText(query.type, 'type'),
    company: parseOptionalText(query.company, 'company'),
    location: parseOptionalText(query.location, 'location'),
  };

  if (query.sort !== undefined) {
    const sortVal = parseOptionalText(query.sort, 'sort');
    if (sortVal !== undefined) {
      const lower = sortVal.toLowerCase();
      if (!['score', 'date', 'recent'].includes(lower)) {
        throw new JobQueryValidationError('Query parameter "sort" must be either "score" or "date".');
      }
      normalized.sort = lower;
    }
  }

  if (query.order !== undefined) {
    const orderVal = parseOptionalText(query.order, 'order');
    if (orderVal !== undefined) {
      const lower = orderVal.toLowerCase();
      if (!['asc', 'desc'].includes(lower)) {
        throw new JobQueryValidationError('Query parameter "order" must be either "asc" or "desc".');
      }
      normalized.order = lower;
    }
  }

  if (query.minScore !== undefined) {
    normalized.minScore = parsePositiveInteger(query.minScore, 'minScore', 0, 100);
  }

  if (query.pjOnly !== undefined) {
    const pjVal = queryValue(query.pjOnly, 'pjOnly');
    normalized.pjOnly = pjVal === true || pjVal === 'true' || pjVal === 1 || pjVal === '1';
  }

  if (query.remoteOnly !== undefined) {
    const remoteVal = queryValue(query.remoteOnly, 'remoteOnly');
    normalized.remoteOnly = remoteVal === true || remoteVal === 'true' || remoteVal === 1 || remoteVal === '1';
  }

  return normalized;
}

function createJobQueryService(provider) {
  const queryProvider = typeof provider === 'function' ? provider : provider && provider.queryJobs;
  if (typeof queryProvider !== 'function') {
    throw new TypeError('A job query provider is required.');
  }

  return async function queryJobs(query) {
    const normalizedQuery = parseJobQuery(query);
    const result = await queryProvider(normalizedQuery);

    if (!result || !Array.isArray(result.items) || !Number.isSafeInteger(result.total) || result.total < 0) {
      throw new Error('The job query provider returned an invalid result.');
    }

    return {
      items: result.items,
      page: normalizedQuery.page,
      limit: normalizedQuery.limit,
      total: result.total,
    };
  };
}

module.exports = {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  JobQueryValidationError,
  parseJobQuery,
  createJobQueryService,
};
