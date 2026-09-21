function nullIfMissing(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'string' && value.trim().toUpperCase() === 'N/A') {
    return null;
  }

  return value;
}

function timestamp(value) {
  return nullIfMissing(value) || new Date().toISOString();
}

function nullableBoolean(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === 1 || value === '1' || value === true) return 1;
  if (value === 0 || value === '0' || value === false) return 0;
  return null;
}

function nullableJson(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function normalizeJob(job) {
  const jobId = nullIfMissing(job.jobId ?? job.job_id);
  const url = nullIfMissing(job.url);

  if (!jobId) {
    throw new Error('Job must have a jobId');
  }
  if (!url) {
    throw new Error(`Job ${jobId} must have a url`);
  }

  const applicationTypeRaw = nullIfMissing(
    job.applicationTypeRaw ?? job.application_type_raw ?? job.type
  );
  const extractedAt = timestamp(job.extractionDate ?? job.extractedAt ?? job.extracted_at);

  return {
    jobId: String(jobId),
    title: nullIfMissing(job.title),
    company: nullIfMissing(job.company),
    queryLocation: nullIfMissing(job.queryLocation ?? job.query_location),
    jobLocation: nullIfMissing(job.jobLocation ?? job.job_location),
    description: nullIfMissing(job.description),
    applicationType: nullIfMissing(job.applicationType ?? job.application_type ?? job.type),
    applicationTypeRaw,
    url: String(url),
    externalUrl: nullIfMissing(job.externalUrl ?? job.external_url),
    aiIsPj: nullableBoolean(job.aiIsPj ?? job.ai_is_pj ?? job.isPJ),
    aiIsRemote: nullableBoolean(job.aiIsRemote ?? job.ai_is_remote ?? job.isRemote),
    aiScore: job.aiScore ?? job.ai_score ?? null,
    aiSummary: nullIfMissing(job.aiSummary ?? job.ai_summary),
    aiEvidence: nullableJson(job.aiEvidence ?? job.ai_evidence ?? job.evidence),
    aiCriteria: nullableJson(job.aiCriteria ?? job.ai_criteria ?? job.criteria),
    aiModel: nullIfMissing(job.aiModel ?? job.ai_model ?? job.model),
    aiProfileVersion: nullIfMissing(
      job.aiProfileVersion ?? job.ai_profile_version ?? job.profileVersion
    ),
    aiScoredAt: nullIfMissing(job.aiScoredAt ?? job.ai_scored_at ?? job.scoredAt),
    firstSeenAt: timestamp(job.firstSeenAt ?? job.first_seen_at ?? extractedAt),
    lastSeenAt: timestamp(job.lastSeenAt ?? job.last_seen_at ?? extractedAt),
    extractedAt,
  };
}

function toPublicJob(row) {
  if (!row) {
    return null;
  }

  return {
    jobId: row.job_id,
    title: row.title,
    company: row.company,
    queryLocation: row.query_location,
    jobLocation: row.job_location,
    description: row.description,
    type: row.application_type,
    applicationTypeRaw: row.application_type_raw,
    url: row.url,
    externalUrl: row.external_url,
    ai:
      row.ai_score === null || row.ai_score === undefined
        ? null
        : {
            eligible: Boolean(row.ai_is_pj && row.ai_is_remote),
            isPJ: Boolean(row.ai_is_pj),
            isRemote: Boolean(row.ai_is_remote),
            score: row.ai_score,
            summary: row.ai_summary,
            evidence: parseJson(row.ai_evidence) || {},
            criteria: parseJson(row.ai_criteria) || {},
            model: row.ai_model,
            profileVersion: row.ai_profile_version,
            scoredAt: row.ai_scored_at,
          },
    extractionDate: row.extracted_at,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  };
}

class JobRepository {
  constructor(db) {
    if (!db) {
      throw new Error('A database connection is required');
    }

    this.db = db;
    this.findIdsStatement = db.prepare(
      'SELECT job_id FROM jobs WHERE job_id IN (SELECT value FROM json_each(?))'
    );
    this.upsertStatement = db.prepare(`
      INSERT INTO jobs (
        job_id, title, company, query_location, job_location, description,
        application_type, application_type_raw, url, external_url,
        ai_is_pj, ai_is_remote, ai_score, ai_summary, ai_evidence, ai_criteria,
        ai_model, ai_profile_version, ai_scored_at,
        first_seen_at, last_seen_at, extracted_at
      ) VALUES (
        @jobId, @title, @company, @queryLocation, @jobLocation, @description,
        @applicationType, @applicationTypeRaw, @url, @externalUrl,
        @aiIsPj, @aiIsRemote, @aiScore, @aiSummary, @aiEvidence, @aiCriteria,
        @aiModel, @aiProfileVersion, @aiScoredAt,
        @firstSeenAt, @lastSeenAt, @extractedAt
      )
      ON CONFLICT(job_id) DO UPDATE SET
        title = excluded.title,
        company = excluded.company,
        query_location = excluded.query_location,
        job_location = excluded.job_location,
        description = excluded.description,
        application_type = excluded.application_type,
        application_type_raw = excluded.application_type_raw,
        url = excluded.url,
        external_url = excluded.external_url,
        ai_is_pj = excluded.ai_is_pj,
        ai_is_remote = excluded.ai_is_remote,
        ai_score = excluded.ai_score,
        ai_summary = excluded.ai_summary,
        ai_evidence = excluded.ai_evidence,
        ai_criteria = excluded.ai_criteria,
        ai_model = excluded.ai_model,
        ai_profile_version = excluded.ai_profile_version,
        ai_scored_at = excluded.ai_scored_at,
        last_seen_at = excluded.last_seen_at,
        extracted_at = excluded.extracted_at
    `);
    this.getByIdStatement = db.prepare('SELECT * FROM jobs WHERE job_id = ?');
    this.listAllStatement = db.prepare('SELECT * FROM jobs ORDER BY first_seen_at ASC, job_id ASC');
  }

  findExistingIds(jobIds) {
    const ids = [...new Set(jobIds.filter(Boolean).map(String))];
    if (ids.length === 0) {
      return new Set();
    }

    const rows = this.findIdsStatement.all(JSON.stringify(ids));
    return new Set(rows.map((row) => row.job_id));
  }

  findIncompleteIds(jobIds) {
    const ids = [...new Set(jobIds.filter(Boolean).map(String))];
    if (ids.length === 0) {
      return new Set();
    }

    const rows = this.db
      .prepare(
        `
        SELECT job_id
        FROM jobs
        WHERE job_id IN (SELECT value FROM json_each(?))
          AND (
            NULLIF(TRIM(COALESCE(title, '')), '') IS NULL
            OR NULLIF(TRIM(COALESCE(description, '')), '') IS NULL
          )
        `
      )
      .all(JSON.stringify(ids));

    return new Set(rows.map((row) => row.job_id));
  }

  upsert(job) {
    const normalized = normalizeJob(job);
    this.upsertStatement.run(normalized);
    return this.getById(normalized.jobId);
  }

  upsertMany(jobs) {
    const saveBatch = this.db.transaction((items) => items.map((job) => this.upsert(job)));
    return saveBatch(jobs);
  }

  getById(jobId) {
    return toPublicJob(this.getByIdStatement.get(String(jobId)));
  }

  listAll() {
    return this.listAllStatement.all().map(toPublicJob);
  }

  queryJobs({
    page = 1,
    limit = 25,
    search,
    type,
    company,
    location,
    sort = 'score',
    order = 'desc',
    minScore,
    pjOnly,
    remoteOnly,
  } = {}) {
    const conditions = [];
    const params = {};

    if (search) {
      conditions.push(
        "(LOWER(COALESCE(title, '')) LIKE @search OR LOWER(COALESCE(company, '')) LIKE @search)"
      );
      params.search = `%${String(search).toLowerCase()}%`;
    }
    if (type) {
      conditions.push("LOWER(COALESCE(application_type, '')) = LOWER(@type)");
      params.type = type;
    }
    if (company) {
      conditions.push("LOWER(COALESCE(company, '')) LIKE @company");
      params.company = `%${String(company).toLowerCase()}%`;
    }
    if (location) {
      conditions.push(
        "(LOWER(COALESCE(job_location, '')) LIKE @location OR LOWER(COALESCE(query_location, '')) LIKE @location)"
      );
      params.location = `%${String(location).toLowerCase()}%`;
    }
    if (minScore !== undefined && minScore !== null && minScore !== '') {
      conditions.push("ai_score IS NOT NULL AND ai_score >= @minScore");
      params.minScore = Number(minScore);
    }
    if (pjOnly === true || pjOnly === 'true' || pjOnly === 1 || pjOnly === '1') {
      conditions.push("ai_is_pj = 1");
    }
    if (remoteOnly === true || remoteOnly === 'true' || remoteOnly === 1 || remoteOnly === '1') {
      conditions.push("ai_is_remote = 1");
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = this.db.prepare(`SELECT COUNT(*) AS count FROM jobs ${where}`).get(params).count;
    const offset = (page - 1) * limit;

    const dir = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    let orderByClause;
    if (sort === 'date' || sort === 'recent') {
      orderByClause = `extracted_at IS NULL ASC, extracted_at ${dir}, job_id ASC`;
    } else {
      orderByClause = `ai_score IS NULL ASC, ai_score ${dir}, extracted_at IS NULL ASC, extracted_at DESC, job_id ASC`;
    }

    const items = this.db
      .prepare(
        `
      SELECT * FROM jobs
      ${where}
      ORDER BY ${orderByClause}
      LIMIT @limit OFFSET @offset
    `
      )
      .all({ ...params, limit, offset })
      .map(toPublicJob);

    return { items, total };
  }
}

function createJobRepository(db) {
  return new JobRepository(db);
}

module.exports = {
  JobRepository,
  createJobRepository,
  normalizeJob,
  toPublicJob,
};
