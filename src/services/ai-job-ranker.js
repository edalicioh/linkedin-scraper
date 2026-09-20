const fs = require('node:fs');

const DEFAULT_JOB_PROFILE = {
  version: 'v1',
  targetRole: 'A vaga deve estar alinhada às palavras-chave usadas na busca.',
  minimumScore: 0,
  criteria: [
    {
      id: 'contractType',
      label: 'Contrato PJ',
      weight: 30,
      description: 'Exija contratação PJ explícita.',
    },
    {
      id: 'workMode',
      label: 'Trabalho remoto',
      weight: 30,
      description: 'Exija trabalho 100% remoto, não híbrido ou presencial.',
    },
    {
      id: 'technicalFit',
      label: 'Aderência técnica',
      weight: 25,
      description: 'Compare tecnologias, responsabilidades e requisitos com as palavras-chave da busca.',
    },
    {
      id: 'seniority',
      label: 'Senioridade',
      weight: 10,
      description: 'Priorize a senioridade procurada e penalize requisitos incompatíveis.',
    },
    {
      id: 'salary',
      label: 'Remuneração',
      weight: 5,
      description: 'Valorize remuneração informada e compatível; não invente valores ausentes.',
    },
    {
      id: 'english',
      label: 'Inglês',
      weight: 0,
      description: 'Considere o nível de inglês somente quando a vaga informar esse requisito.',
    },
  ],
};

function loadJobProfile(filePath) {
  if (!filePath) return DEFAULT_JOB_PROFILE;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return DEFAULT_JOB_PROFILE;
    throw new Error(`Não foi possível ler o perfil de vagas em ${filePath}: ${error.message}`);
  }
}

function assertProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new Error('O perfil de vagas deve ser um objeto JSON.');
  }
  if (!Array.isArray(profile.criteria)) {
    throw new Error('O perfil de vagas deve conter um array "criteria".');
  }

  return {
    ...DEFAULT_JOB_PROFILE,
    ...profile,
    criteria: profile.criteria,
    minimumScore: Number.isFinite(Number(profile.minimumScore)) ? Number(profile.minimumScore) : 0,
  };
}

function buildPrompt(job, profile, context = {}) {
  return [
    'Analise a vaga abaixo para um candidato. Responda SOMENTE com JSON válido, sem markdown.',
    'Não faça suposições: se o texto não confirmar explicitamente um requisito, marque-o como false.',
    'PJ inclui pessoa jurídica/contrato PJ. Remoto inclui trabalho 100% remoto/home office; híbrido ou presencial não conta.',
    'Se a vaga disser "CLT ou PJ", aceite PJ somente quando PJ for uma opção explícita. Se disser que não aceita PJ, marque false.',
    'O campo score deve ser um número de 0 a 100 calculado pelos pesos do perfil.',
    'Formato obrigatório:',
    JSON.stringify({
      isPJ: true,
      isRemote: true,
      score: 0,
      summary: 'Resumo curto em português.',
      evidence: { pj: 'Trecho literal que prova PJ.', remote: 'Trecho literal que prova remoto.' },
      criteria: { technicalFit: { score: 0, reason: 'Motivo curto.' } },
    }),
    `Perfil do candidato e prioridades:\n${JSON.stringify(profile)}`,
    `Palavras-chave da busca: ${context.keywords || 'não informadas'}`,
    `Local pesquisado: ${context.location || 'não informado'}`,
    `Dados da vaga:\n${JSON.stringify({
      title: job.title || null,
      company: job.company || null,
      jobLocation: job.jobLocation || null,
      description: job.description || null,
      url: job.url || null,
    })}`,
  ].join('\n\n');
}

function extractJson(content) {
  if (typeof content !== 'string') {
    throw new Error('A IA não retornou conteúdo textual.');
  }

  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch (_error) {
    throw new Error('A IA retornou uma resposta que não é JSON válido.');
  }
}

function validateAiResult(result, profile) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('A resposta da IA deve ser um objeto JSON.');
  }
  const isPJ = result.isPJ ?? result.is_pj;
  const isRemote = result.isRemote ?? result.is_remote;
  if (typeof isPJ !== 'boolean' || typeof isRemote !== 'boolean') {
    throw new Error('A resposta da IA deve informar isPJ e isRemote como booleanos.');
  }

  const score = Number(result.score ?? result.ai_score ?? result.nota);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error('A resposta da IA deve informar score entre 0 e 100.');
  }

  return {
    eligible: isPJ && isRemote && score >= profile.minimumScore,
    isPJ,
    isRemote,
    score: Math.round(score * 100) / 100,
    summary: typeof result.summary === 'string' ? result.summary.trim() : '',
    evidence: result.evidence && typeof result.evidence === 'object' ? result.evidence : {},
    criteria: result.criteria && typeof result.criteria === 'object' ? result.criteria : {},
  };
}

function createAiJobRanker({
  baseUrl,
  apiKey,
  model,
  profile,
  profilePath,
  timeoutMs = 30000,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!baseUrl) throw new Error('AI_BASE_URL não configurado.');
  if (!apiKey) throw new Error('AI_API_KEY não configurado.');
  if (!model) throw new Error('AI_MODEL não configurado.');
  if (typeof fetchImpl !== 'function') throw new Error('fetch não está disponível neste Node.js.');

  const loadedProfile = assertProfile(profile || loadJobProfile(profilePath));
  const endpoint = `${String(baseUrl).replace(/\/+$/, '')}/chat/completions`;

  return async function rankJob(job, context = {}) {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: 'Você é um avaliador rigoroso de vagas. Siga exatamente o formato JSON solicitado.',
          },
          { role: 'user', content: buildPrompt(job, loadedProfile, context) },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const body = typeof response.text === 'function' ? await response.text() : '';
      throw new Error(`Falha na API de IA (${response.status}): ${body.slice(0, 300)}`);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    const result = validateAiResult(extractJson(content), loadedProfile);
    return {
      ...result,
      model,
      profileVersion: String(loadedProfile.version || 'v1'),
      scoredAt: new Date().toISOString(),
    };
  };
}

module.exports = {
  DEFAULT_JOB_PROFILE,
  loadJobProfile,
  buildPrompt,
  extractJson,
  validateAiResult,
  createAiJobRanker,
};
