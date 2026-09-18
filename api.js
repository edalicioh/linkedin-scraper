const { createApp } = require('./src/app');
const PORT = process.env.PORT || 3000;

if (require.main === module) {
  const app = createApp();

  app.listen(PORT, () => {
    console.log(`Servidor API rodando na porta ${PORT}`);
  });
}

module.exports = { createApp };
