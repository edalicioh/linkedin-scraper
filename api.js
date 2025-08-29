const express = require('express');
const jobRoutes = require('./src/routes/jobRoutes');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON no body
app.use(express.json());

// Rota de teste
app.get('/', (req, res) => {
    res.json({ message: 'API do Scraper do LinkedIn está rodando!' });
});

// Usar as rotas definidas em jobRoutes
app.use('/api', jobRoutes);

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor API rodando na porta ${PORT}`);
});