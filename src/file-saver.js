const fse = require('fs-extra');
const path = require('path');

/**
 * Salva os dados em um arquivo JSON, sobrescrevendo o conteúdo existente.
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

/**
 * Adiciona os novos dados a um arquivo JSON existente.
 * @param {string} fileName - O nome do arquivo de saída.
 * @param {object[]} newData - Os novos dados a serem adicionados.
 */
async function appendAsJson(fileName, newData) {
  const outputPath = path.join(__dirname, '..', fileName);
  try {
    let existingData = [];
    try {
      // Tenta ler os dados existentes
      existingData = await fse.readJson(outputPath);
      // Verifica se é um array
      if (!Array.isArray(existingData)) {
        console.warn(`O arquivo ${fileName} não contém um array. Criando um novo array.`);
        existingData = [];
      }
    } catch (err) {
      // Se o arquivo não existir ou estiver corrompido, começa com um array vazio
      console.log(`Arquivo ${fileName} não encontrado ou corrompido. Criando um novo.`);
      existingData = [];
    }

    // Combina os dados existentes com os novos
    const combinedData = [...existingData, ...newData];
    
    // Salva o array combinado
    await fse.writeJson(outputPath, combinedData, { spaces: 2 });
    console.log(`Dados adicionados com sucesso em ${outputPath}. Total de vagas: ${combinedData.length}`);
  } catch (error) {
    console.error(`Erro ao adicionar dados ao arquivo ${fileName}:`, error);
  }
}

module.exports = {
  saveAsJson,
  appendAsJson,
};