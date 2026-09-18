const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { STORAGE_DIR } = require('../core/config');

function resolveOutputPath(fileName, options = {}) {
  if (options.filePath) {
    return options.filePath;
  }

  if (path.isAbsolute(fileName)) {
    return fileName;
  }

  return path.join(options.storageDir || STORAGE_DIR, fileName);
}

async function writeJsonAtomically(outputPath, data) {
  const directory = path.dirname(outputPath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(outputPath)}.${process.pid}.${crypto.randomUUID()}.tmp`,
  );

  await fs.mkdir(directory, { recursive: true });

  try {
    await fs.writeFile(`${temporaryPath}`, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await fs.rename(temporaryPath, outputPath);
  } catch (error) {
    await fs.unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

async function readJsonArray(fileName, options = {}) {
  const filePath = resolveOutputPath(fileName, options);
  let contents;
  try {
    contents = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  let data;
  try {
    data = JSON.parse(contents);
  } catch (error) {
    throw new Error(`JSON inválido em ${filePath}: ${error.message}`);
  }

  if (!Array.isArray(data)) {
    throw new Error(`O arquivo ${filePath} deve conter um array JSON.`);
  }

  return data;
}

/**
 * Salva os dados em um arquivo JSON, sobrescrevendo o conteúdo existente.
 * @param {string} fileName - O nome do arquivo de saída.
 * @param {object[]} data - Os dados a serem salvos.
 */
async function saveAsJson(fileName, data, options = {}) {
  const outputPath = resolveOutputPath(fileName, options);
  await writeJsonAtomically(outputPath, data);
  console.log(`Dados salvos com sucesso em ${outputPath}`);
}

/**
 * Adiciona os novos dados a um arquivo JSON existente.
 * @param {string} fileName - O nome do arquivo de saída.
 * @param {object[]} newData - Os novos dados a serem adicionados.
 */
async function appendAsJson(fileName, newData, options = {}) {
  const outputPath = resolveOutputPath(fileName, options);
  const existingData = await readJsonArray(outputPath);
  const combinedData = [...existingData, ...newData];

  await writeJsonAtomically(outputPath, combinedData);
  console.log(`Dados adicionados com sucesso em ${outputPath}. Total de vagas: ${combinedData.length}`);
}

module.exports = {
  saveAsJson,
  appendAsJson,
  readJsonArray,
  writeJsonAtomically,
};
