const fs = require('fs').promises;
const path = require('path');

const DEFAULT_FILE_PATH = path.join(__dirname, '..', 'storage', 'vagas.json');
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;

class JobQueryReadError extends Error {
  constructor() {
    super('Failed to read jobs.');
    this.name = 'JobQueryReadError';
    this.code = 'JOBS_READ_FAILED';
    this.statusCode = 500;
  }
}

function text(value) {
  return value === undefined || value === null ? '' : String(value);
}

function lower(value) {
  return text(value).toLowerCase();
}

function includesFilter(value, filter) {
  return lower(value).includes(lower(filter));
}

function firstValue(job, fields) {
  for (const field of fields) {
    if (job[field] !== undefined && job[field] !== null) {
      return job[field];
    }
  }

  return undefined;
}

function matchesJob(job, filters) {
  const title = firstValue(job, ['title', 'titulo']);
  const company = firstValue(job, ['company', 'empresa']);
  const type = firstValue(job, ['type', 'applicationType', 'application_type']);
  const locations = ['location', 'jobLocation', 'job_location', 'queryLocation', 'query_location']
    .map(field => job[field]);

  if (filters.search && !includesFilter(`${text(title)} ${text(company)}`, filters.search)) {
    return false;
  }

  if (filters.type && lower(type) !== lower(filters.type)) {
    return false;
  }

  if (filters.company && !includesFilter(company, filters.company)) {
    return false;
  }

  if (filters.location && !locations.some(location => includesFilter(location, filters.location))) {
    return false;
  }

  return true;
}

function extractionTime(job) {
  const value = firstValue(job, ['extractionDate', 'extractedAt', 'extracted_at']);
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const timestamp = Date.parse(String(value));
  return Number.isNaN(timestamp) ? null : timestamp;
}

function jobId(job) {
  return text(firstValue(job, ['jobId', 'job_id']));
}

function sortJobs(jobs) {
  return jobs
    .map((job, index) => ({ job, index, extractedAt: extractionTime(job), id: jobId(job) }))
    .sort((left, right) => {
      if (left.extractedAt !== right.extractedAt) {
        if (left.extractedAt === null) return 1;
        if (right.extractedAt === null) return -1;
        return right.extractedAt - left.extractedAt;
      }

      if (left.id < right.id) return -1;
      if (left.id > right.id) return 1;
      return left.index - right.index;
    })
    .map(entry => entry.job);
}

async function readJobs(filePath, readFile) {
  let data;
  try {
    data = await readFile(filePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [];
    }

    throw new JobQueryReadError();
  }

  if (!data.trim()) {
    return [];
  }

  try {
    const jobs = JSON.parse(data);
    if (!Array.isArray(jobs)) {
      throw new Error('Jobs JSON must be an array.');
    }
    return jobs.filter(job => job && typeof job === 'object' && !Array.isArray(job));
  } catch (error) {
    throw new JobQueryReadError();
  }
}

function createJsonJobQueryProvider(options = {}) {
  const { filePath = DEFAULT_FILE_PATH, readFile = fs.readFile } = typeof options === 'string'
    ? { filePath: options }
    : options;

  return {
    async queryJobs({ page = DEFAULT_PAGE, limit = DEFAULT_LIMIT, search, type, company, location } = {}) {
      const jobs = await readJobs(filePath, readFile);
      const filteredJobs = sortJobs(jobs.filter(job => matchesJob(job, { search, type, company, location })));
      const offset = (page - 1) * limit;

      return {
        items: filteredJobs.slice(offset, offset + limit),
        total: filteredJobs.length,
      };
    },
  };
}

module.exports = {
  DEFAULT_FILE_PATH,
  JobQueryReadError,
  createJsonJobQueryProvider,
};
