const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createAiJobRanker,
  extractJson,
  validateAiResult,
} = require('../src/services/ai-job-ranker');

test('valida os requisitos obrigatórios e calcula elegibilidade', () => {
  const result = validateAiResult(
    {
      isPJ: true,
      isRemote: true,
      score: 87.4,
      summary: 'Boa aderência',
    },
    { minimumScore: 80 }
  );

  assert.equal(result.eligible, true);
  assert.equal(result.score, 87.4);
});

test('não aceita resposta ambígua para PJ ou remoto', () => {
  assert.throws(
    () => validateAiResult({ isPJ: 'sim', isRemote: true, score: 90 }, { minimumScore: 0 }),
    /booleanos/
  );
  assert.equal(
    validateAiResult({ is_pj: true, is_remote: true, nota: 85 }, { minimumScore: 0 }).eligible,
    true
  );
  assert.equal(
    validateAiResult({ isPJ: true, isRemote: false, score: 100 }, { minimumScore: 0 }).eligible,
    false
  );
});

test('chama endpoint OpenAI compatível com Bearer e interpreta JSON', async () => {
  let request;
  const rankJob = createAiJobRanker({
    baseUrl: 'http://ai.local/v1/',
    apiKey: 'secret',
    model: 'local-model',
    profile: { version: 'profile-1', minimumScore: 0, criteria: [] },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '```json\n{"isPJ":true,"isRemote":true,"score":91,"summary":"ok"}\n```',
              },
            },
          ],
        }),
      };
    },
  });

  const result = await rankJob(
    { title: 'Backend', company: 'Example', description: 'PJ remoto', url: 'https://job' },
    { keywords: 'backend', location: 'Brasil' }
  );

  assert.equal(request.url, 'http://ai.local/v1/chat/completions');
  assert.equal(request.options.headers.Authorization, 'Bearer secret');
  assert.equal(JSON.parse(request.options.body).model, 'local-model');
  assert.equal(result.eligible, true);
  assert.equal(result.profileVersion, 'profile-1');
});

test('extrai JSON cercado por markdown', () => {
  assert.deepEqual(extractJson('```json\n{"score": 1}\n```'), { score: 1 });
});
