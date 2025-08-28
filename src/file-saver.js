const fse = require('fs-extra');
const path = require('path');

/**
 * Salva os dados em um arquivo JSON.
 * @param {string} fileName - O nome do arquivo de saída.
 * @param {object[]} data - Os dados a serem salvos.
 */
async function saveAsJson(fileName, data) {
  const outputPath = path.join(__dirname, '..', fileName);
  try {
    await fse.writeJson(outputPath, data, { spaces: 2 });
    console.log(`Dados salvos com sucesso em ${outputPath}`);
  } catch (error) {
    console.error(`Erro ao salvar o arquivo ${fileName}:`, error);
  }
}

module.exports = {
  saveAsJson,
};