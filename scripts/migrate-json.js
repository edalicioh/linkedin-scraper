const fs = require('fs');
const path = require('path');
const { createDatabase, DEFAULT_DB_PATH } = require('../src/db/database');
const { createJobRepository } = require('../src/repositories/jobRepository');

const HISTORICAL_JSON_PATHS = [
  path.join('vagas.json'),
  path.join('storage', 'vagas.json'),
  path.join('src', 'storage', 'vagas.json'),
];

function backupSource(sourcePath) {
  const backupPath = `${sourcePath}.bak`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(sourcePath, backupPath);
  }
  return backupPath;
}

function migrateJson({ projectRoot = path.join(__dirname, '..'), dbPath = DEFAULT_DB_PATH } = {}) {
  const db = createDatabase(dbPath);
  const repository = createJobRepository(db);
  const report = {
    imported: 0,
    rejected: [],
    duplicates: 0,
    files: [],
    backups: [],
  };

  try {
    for (const relativePath of HISTORICAL_JSON_PATHS) {
      const sourcePath = path.resolve(projectRoot, relativePath);
      if (!fs.existsSync(sourcePath)) {
        continue;
      }

      const fileReport = { path: sourcePath, imported: 0, rejected: 0, duplicates: 0 };
      try {
        const backupPath = backupSource(sourcePath);
        fileReport.backupPath = backupPath;
        report.backups.push(backupPath);
        const raw = fs.readFileSync(sourcePath, 'utf8');
        const records = JSON.parse(raw);
        if (!Array.isArray(records)) {
          throw new Error('JSON root must be an array');
        }

        for (const [index, record] of records.entries()) {
          try {
            const existing = record && record.jobId && repository.getById(record.jobId);
            repository.upsert(record);
            fileReport.imported += 1;
            report.imported += 1;
            if (existing) {
              fileReport.duplicates += 1;
              report.duplicates += 1;
            }
          } catch (error) {
            const rejection = { path: sourcePath, index, reason: error.message };
            fileReport.rejected += 1;
            report.rejected.push(rejection);
          }
        }
      } catch (error) {
        const rejection = { path: sourcePath, reason: error.message };
        fileReport.rejected += 1;
        report.rejected.push(rejection);
      }

      report.files.push(fileReport);
    }

    return report;
  } finally {
    db.close();
  }
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(migrateJson(), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  HISTORICAL_JSON_PATHS,
  migrateJson,
};
