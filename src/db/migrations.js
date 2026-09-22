const MIGRATIONS = [
  {
    version: 1,
    sql: `
      CREATE TABLE jobs (
        job_id TEXT PRIMARY KEY,
        title TEXT,
        company TEXT,
        query_location TEXT,
        job_location TEXT,
        description TEXT,
        application_type TEXT,
        application_type_raw TEXT,
        url TEXT NOT NULL,
        external_url TEXT,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        extracted_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    sql: `
      ALTER TABLE jobs ADD COLUMN ai_is_pj INTEGER;
      ALTER TABLE jobs ADD COLUMN ai_is_remote INTEGER;
      ALTER TABLE jobs ADD COLUMN ai_score REAL;
      ALTER TABLE jobs ADD COLUMN ai_summary TEXT;
      ALTER TABLE jobs ADD COLUMN ai_evidence TEXT;
      ALTER TABLE jobs ADD COLUMN ai_criteria TEXT;
      ALTER TABLE jobs ADD COLUMN ai_model TEXT;
      ALTER TABLE jobs ADD COLUMN ai_profile_version TEXT;
      ALTER TABLE jobs ADD COLUMN ai_scored_at TEXT;
    `,
  },
  {
    version: 3,
    sql: `
      ALTER TABLE jobs ADD COLUMN review_status TEXT NOT NULL DEFAULT 'new';
    `,
  },
];

function applyMigrations(db) {
  const currentVersion = db.pragma('user_version', { simple: true });
  const pendingMigrations = MIGRATIONS.filter(({ version }) => version > currentVersion);

  if (pendingMigrations.length === 0) {
    return currentVersion;
  }

  const migrate = db.transaction(() => {
    let version = currentVersion;

    for (const migration of pendingMigrations) {
      db.exec(migration.sql);
      db.pragma(`user_version = ${migration.version}`);
      version = migration.version;
    }

    return version;
  });

  return migrate();
}

module.exports = {
  MIGRATIONS,
  applyMigrations,
};
