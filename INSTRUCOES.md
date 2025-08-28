# 📝 Instruções para Execução do Scraper de Vagas do LinkedIn

## 1. 🔧 Configuração Inicial

Antes de executar o scraper, você precisa configurar suas credenciais do LinkedIn:

1. Abra o arquivo `.env` no diretório `linkedin-scraper`.
2. Substitua `seu_email@exemplo.com` pelo seu e-mail do LinkedIn.
3. Substitua `sua_senha` pela sua senha do LinkedIn.

**⚠️ Aviso de Segurança:**
- Nunca compartilhe suas credenciais reais.
- Não versione o arquivo `.env` no controle de versão (já está no `.gitignore`).
- Após usar o scraper, considere alterar sua senha do LinkedIn por segurança.

## 2. ▶️ Executando o Scraper

Para executar o scraper, use o seguinte comando no terminal:

```bash
node scraper.js
```

Certifique-se de estar no diretório `linkedin-scraper` ao executar o comando.

## 3. 📁 Resultados

Após a execução bem-sucedida, você encontrará um arquivo chamado `vagas.json` no diretório `linkedin-scraper`. Este arquivo contém os dados das vagas coletadas.

## 4. ⚠️ Considerações Importantes

- O LinkedIn pode alterar seus seletores HTML a qualquer momento, o que pode quebrar o scraper.
- Use delays adequados entre as requisições para evitar ser bloqueado.
- Este scraper é apenas para fins educacionais. Recomenda-se o uso da API oficial do LinkedIn sempre que possível.

## 5. 🛠️ Manutenção

Se o scraper parar de funcionar, verifique:

1. Se os seletores CSS no código ainda são válidos.
2. Se o LinkedIn não implementou novas medidas de segurança.
3. Se as dependências estão atualizadas (`npm update`).