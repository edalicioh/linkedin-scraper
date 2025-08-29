# 🕵️‍♂️ Scraper de Vagas do LinkedIn (Node.js - Refatorado)

Este projeto é um scraper otimizado para coletar vagas do LinkedIn usando **Node.js** com **Puppeteer**. Ele foi totalmente refatorado para ser mais modular, eficiente e fácil de manter.

> ⚠️ **Aviso Legal**: O LinkedIn tem políticas rígidas contra scraping não autorizado. Este código é apenas para fins educacionais. Recomenda-se o uso da [LinkedIn API oficial](https://learn.microsoft.com/en-us/linkedin/) sempre que possível.

---

## 🧠 Funcionalidades

- **Login Automático**: Faz login no LinkedIn usando credenciais fornecidas.
- **Gerenciamento Inteligente de Sessão**: Salva e reutiliza cookies de sessão para evitar login repetido.
- **Extração de Dados Específicos**: Coleta `titulo`, `descrição`, `empresa` e `url da vaga`.
- **Estrutura Modular**: Código organizado em módulos para fácil manutenção e expansão.
- **Tratamento de Erros**: Estratégias robustas para lidar com timeouts e mudanças no site.

---

## 📁 Estrutura do Projeto

```
linkedin-scraper/
│
├── src/
│   ├── browser.js         # Gerencia a instância do Puppeteer
│   ├── config.js          # Carrega as variáveis de ambiente
│   ├── file-saver.js      # Salva os dados em arquivos
│   ├── linkedin.js        # Contém a lógica de scraping do LinkedIn
│   └── session-manager.js # Gerencia cookies de sessão
│
├── scraper.js             # Orquestrador principal
├── .env                   # Arquivo de configuração (não incluído no repositório)
├── cookies.json           # Cookies de sessão salvos (gerado automaticamente)
├── vagas.json             # Dados coletados
├── package.json
└── node_modules/
```

---

## 🚀 Como Usar

### 1. 🔧 Configurar o Ambiente

```bash
# Clonar o repositório (se aplicável) ou navegar até o diretório do projeto
cd linkedin-scraper

# Instalar dependências
npm install
```

### 2. ⚙️ Configurar Credenciais

Crie um arquivo `.env` na raiz do projeto com suas credenciais do LinkedIn:

```env
LINKEDIN_EMAIL=seu_email@example.com
LINKEDIN_PASSWORD=sua_senha
```

> 🔐 **Importante**: Nunca commite o arquivo `.env`. Ele já está no `.gitignore`.

### 3. ▶️ Executar o Scraper

```bash
npm start
# ou
node scraper.js
```

Na primeira execução, o scraper fará login e salvará os cookies. Nas execuções subsequentes, ele tentará reutilizar a sessão salva.


### 4. 🌐 Executar a API (Opcional)

A partir da refatoração, o projeto também inclui uma API REST simples para acionar o scraping.

#### Iniciar o Servidor

```bash
npm run start:api
# ou
node api.js
```

O servidor API estará disponível em `http://localhost:3000` por padrão.

#### Usar o Endpoint de Scraping

Faça uma requisição `POST` para `http://localhost:3000/scrape` com um JSON contendo `keywords` e `location`:

```bash
curl -X POST http://localhost:3000/scrape \
    -H "Content-Type: application/json" \
    -d '{"keywords": "desenvolvedor javascript", "location": "São Paulo"}'
```

A API responderá imediatamente e o processo de scraping será iniciado em background. Os resultados serão salvos no arquivo `vagas.json` como de costume.

#### Usar o Endpoint para Obter Jobs

Você também pode obter a lista de jobs coletados fazendo uma requisição `GET` para `http://localhost:3000/api/jobs`:

```bash
curl -X GET http://localhost:3000/api/jobs
```

Se o arquivo `vagas.json` não existir ou estiver vazio, a API retornará um array vazio `[]`. Após a execução do scraper, este endpoint retornará os dados no formato JSON.


---

## 🧪 Testar em Ambiente Controlado

1. Execute o script:
   ```bash
   npm start
   ```

2. Verifique:
   - Se o login foi bem-sucedido (ou se a sessão foi carregada).
   - Se o arquivo `vagas.json` foi gerado com os dados das vagas.

---

## 🔄 Manutenção e Atualizações

O LinkedIn pode alterar seus seletores HTML. Revise periodicamente:

- Seletores CSS no arquivo `src/linkedin.js`.
- Estrutura da página de vagas.
- Comportamento de login (pode exigir 2FA ou CAPTCHA).

---

## 🛠️ Arquitetura do Código

O projeto foi refatorado para ser modular:

- `scraper.js`: O orquestrador principal que chama os módulos.
- `src/browser.js`: Gerencia a instância do navegador Puppeteer.
- `src/config.js`: Carrega as variáveis de ambiente de forma segura.
- `src/linkedin.js`: Contém toda a lógica específica do LinkedIn (login, extração de vagas).
- `src/file-saver.js`: Lida com a gravação dos dados em arquivos.
- `src/session-manager.js`: Implementa o sistema de gerenciamento de sessão com cookies.

---

## ✅ Alternativa Recomendada: Usar a API do LinkedIn

Se possível, migre para:

- [LinkedIn Jobs API](https://learn.microsoft.com/en-us/linkedin/talent/)
- Autenticação OAuth 2.0
- Acesso legal e sustentável

---

## 🛑 Considerações Finais

- ❌ Não use em produção sem autorização.
- ✅ Use delays e evite múltiplas execuções rápidas.
- 🔐 Nunca exponha credenciais no código (use `.env`).
- 🌐 Considere hospedar em local seguro, se automatizado.