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
    `
  }
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
  applyMigrations
};
