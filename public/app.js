// Configuração e Estado Global
const STORAGE_KEY_API = 'linkedin_scraper_api_url';
let apiBaseUrl = getInitialApiBase();

let state = {
  page: 1,
  limit: 25,
  total: 0,
  filters: {
    search: '',
    location: '',
    company: '',
    type: '',
  },
  activeTaskId: null,
  pollTimer: null,
};

function getInitialApiBase() {
  const saved = localStorage.getItem(STORAGE_KEY_API);
  if (saved) return saved.trim().replace(/\/$/, '');
  return window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
}

function setApiBase(url) {
  apiBaseUrl = (url || '').trim().replace(/\/$/, '');
  localStorage.setItem(STORAGE_KEY_API, apiBaseUrl);
  updateRawApiLink();
  checkApiHealth();
  fetchJobs();
}

function updateRawApiLink() {
  const link = document.getElementById('raw-api-link');
  if (link) {
    link.href = `${apiBaseUrl || ''}/api/jobs`;
  }
}

// Utilitários de escape HTML para segurança
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(isoString) {
  if (!isoString) return 'Data não informada';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

// Alertas e Mensagens
function showAlert(message, type = 'info', timeout = 5000) {
  const alertEl = document.getElementById('global-alert');
  const messageEl = document.getElementById('global-alert-message');
  alertEl.className = `alert alert-${type}`;
  messageEl.textContent = message;
  alertEl.classList.remove('hidden');

  if (timeout > 0) {
    setTimeout(() => {
      alertEl.classList.add('hidden');
    }, timeout);
  }
}

function hideAlert() {
  document.getElementById('global-alert').classList.add('hidden');
}

// Verificação de Conexão com a API
async function checkApiHealth() {
  const badge = document.getElementById('api-status-badge');
  const statusText = document.getElementById('api-status-text');

  badge.className = 'status-indicator checking';
  statusText.textContent = 'Verificando...';

  try {
    const res = await fetch(`${apiBaseUrl}/`, { method: 'GET' });
    if (res.ok) {
      badge.className = 'status-indicator online';
      statusText.textContent = 'API Online';
    } else {
      badge.className = 'status-indicator offline';
      statusText.textContent = `API Erro (${res.status})`;
    }
  } catch {
    badge.className = 'status-indicator offline';
    statusText.textContent = 'API Desconectada';
  }
}

// Consulta de Vagas (GET /api/jobs)
async function fetchJobs() {
  const container = document.getElementById('jobs-container');
  const countDetail = document.getElementById('results-count-detail');

  container.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Carregando vagas...</p>
    </div>
  `;

  const params = new URLSearchParams();
  params.set('page', state.page);
  params.set('limit', state.limit);

  if (state.filters.search) params.set('search', state.filters.search);
  if (state.filters.location) params.set('location', state.filters.location);
  if (state.filters.company) params.set('company', state.filters.company);
  if (state.filters.type) params.set('type', state.filters.type);

  try {
    const url = `${apiBaseUrl}/api/jobs?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      let errorMsg = `Erro ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson.error && errJson.error.message) {
          errorMsg = errJson.error.message;
        }
      } catch {
        // Ignora falha de parse
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    state.total = data.total || 0;
    renderJobs(data.items || []);
    updatePagination();
    countDetail.textContent = `${state.total} vaga(s) encontrada(s)`;
  } catch (error) {
    countDetail.textContent = 'Erro ao consultar vagas';
    container.innerHTML = `
      <div class="empty-state">
        <h4>Falha ao carregar vagas</h4>
        <p>${escapeHtml(error.message)}</p>
        <p class="text-muted" style="margin-top: 8px;">
          Certifique-se de que a API está rodando com <code>npm run start:api</code> em ${escapeHtml(apiBaseUrl || 'porta 3000')}.
        </p>
        <button id="retry-fetch-btn" class="btn btn-primary" style="margin-top: 14px;">
          Tentar novamente
        </button>
      </div>
    `;
    const retryBtn = document.getElementById('retry-fetch-btn');
    if (retryBtn) retryBtn.addEventListener('click', fetchJobs);
  }
}

// Renderização dos Cards de Vagas
function renderJobs(jobs) {
  const container = document.getElementById('jobs-container');

  if (!jobs || jobs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h4>Nenhuma vaga encontrada</h4>
        <p>Nenhum registro corresponde aos filtros selecionados ou ainda não há vagas coletadas.</p>
        <p class="text-muted" style="margin-top: 6px;">Dica: Utilize o formulário acima para iniciar uma nova coleta de vagas.</p>
      </div>
    `;
    return;
  }

  const html = jobs
    .map((job) => {
      const company = job.company || 'Empresa não informada';
      const location = job.jobLocation || job.queryLocation || 'Localização não informada';
      const dateFormatted = formatDate(job.extractionDate || job.firstSeenAt);
      const hasExternalUrl = Boolean(job.externalUrl);
      const description = job.description
        ? escapeHtml(job.description)
        : 'Nenhuma descrição detalhada disponível.';

      return `
      <article class="job-card" data-job-id="${escapeHtml(job.jobId)}">
        <header class="job-card-header">
          <div>
            <h4 class="job-title">${escapeHtml(job.title || 'Título não especificado')}</h4>
            <div class="job-meta">
              <span class="job-meta-item">🏢 <strong>${escapeHtml(company)}</strong></span>
              <span class="job-meta-item">📍 ${escapeHtml(location)}</span>
            </div>
          </div>
        </header>

        <div class="job-badges">
          ${
            job.ai
              ? `<span class="tag tag-type">⭐ Nota IA: ${escapeHtml(String(job.ai.score))}</span>`
              : ''
          }
          ${job.ai?.isPJ && job.ai?.isRemote ? '<span class="tag tag-app">PJ · Remoto</span>' : ''}
          ${job.type ? `<span class="tag tag-type">💼 ${escapeHtml(job.type)}</span>` : ''}
          ${
            job.applicationTypeRaw
              ? `<span class="tag tag-app">⚡ ${escapeHtml(job.applicationTypeRaw)}</span>`
              : ''
          }
          <span class="tag tag-date">📅 Coletada em: ${escapeHtml(dateFormatted)}</span>
        </div>

        <div class="job-description-wrapper">
          ${job.ai?.summary ? `<p class="text-muted">Triagem IA: ${escapeHtml(job.ai.summary)}</p>` : ''}
          <div class="job-description-content collapsed" id="desc-${escapeHtml(job.jobId)}">
            ${description}
          </div>
          ${
            job.description && job.description.length > 200
              ? `<button class="toggle-description-btn" data-target="desc-${escapeHtml(job.jobId)}">Ver mais da descrição</button>`
              : ''
          }
        </div>

        <footer class="job-card-actions">
          ${
            job.url
              ? `<a href="${escapeHtml(job.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
                  🔗 Ver no LinkedIn
                </a>`
              : ''
          }
          ${
            hasExternalUrl
              ? `<a href="${escapeHtml(job.externalUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
                  🌐 Candidatura Externa
                </a>`
              : ''
          }
        </footer>
      </article>
    `;
    })
    .join('');

  container.innerHTML = html;

  // Listeners para expandir/recolher descrições
  container.querySelectorAll('.toggle-description-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const contentEl = document.getElementById(targetId);
      if (contentEl) {
        const isCollapsed = contentEl.classList.toggle('collapsed');
        btn.textContent = isCollapsed ? 'Ver mais da descrição' : 'Recolher descrição';
      }
    });
  });
}

// Atualização da Paginação
function updatePagination() {
  const totalPages = Math.max(1, Math.ceil(state.total / state.limit));
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');
  const info = document.getElementById('pagination-info');

  info.textContent = `Página ${state.page} de ${totalPages}`;
  prevBtn.disabled = state.page <= 1;
  nextBtn.disabled = state.page >= totalPages;
}

// Disparar Scraping (POST /api/scrape)
async function handleScrapeSubmit(e) {
  e.preventDefault();

  const keywords = document.getElementById('scrape-keywords').value.trim();
  const location = document.getElementById('scrape-location').value.trim();
  const btn = document.getElementById('start-scrape-btn');
  const btnText = btn.querySelector('.btn-text');
  const btnSpinner = btn.querySelector('.btn-spinner');

  if (!keywords || !location) {
    showAlert('Preencha os campos de palavras-chave e localização.', 'error');
    return;
  }

  btn.disabled = true;
  btnText.textContent = 'Enfileirando...';
  if (btnSpinner) btnSpinner.classList.remove('hidden');

  try {
    const res = await fetch(`${apiBaseUrl}/api/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords, location }),
    });

    const data = await res.json();

    if (res.status === 202) {
      showAlert(`Coleta iniciada com sucesso! Tarefa: ${data.taskId}`, 'success');
      startTaskPolling(data.taskId);
    } else {
      const msg = data.error || 'Falha ao iniciar scraping.';
      showAlert(msg, 'error');
    }
  } catch (error) {
    showAlert(`Erro de conexão com a API: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btnText.textContent = 'Iniciar Scraping';
    if (btnSpinner) btnSpinner.classList.add('hidden');
  }
}

// Acompanhamento do Status da Tarefa (GET /api/scrape/:taskId)
function startTaskPolling(taskId) {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
  }

  state.activeTaskId = taskId;

  const tracker = document.getElementById('scrape-task-tracker');
  const taskIdEl = document.getElementById('task-id');
  const statusBadge = document.getElementById('task-status-badge');
  const taskInfo = document.getElementById('task-info');
  const countsBox = document.getElementById('task-counts');

  tracker.classList.remove('hidden');
  taskIdEl.textContent = taskId;
  statusBadge.className = 'badge badge-pending';
  statusBadge.textContent = 'PENDING';
  taskInfo.textContent = 'Tarefa na fila. Aguardando execução do scraper...';
  countsBox.classList.add('hidden');

  async function poll() {
    try {
      const res = await fetch(`${apiBaseUrl}/api/scrape/${taskId}`);
      if (!res.ok) return;

      const task = await res.json();
      statusBadge.textContent = task.status;
      statusBadge.className = `badge badge-${task.status.toLowerCase()}`;

      if (task.status === 'RUNNING') {
        taskInfo.textContent = 'Navegador ativo e extraindo vagas do LinkedIn...';
      } else if (task.status === 'COMPLETED') {
        taskInfo.textContent = 'Coleta finalizada com sucesso!';
        clearInterval(state.pollTimer);
        state.pollTimer = null;

        if (task.counts) {
          countsBox.classList.remove('hidden');
          document.getElementById('count-found').textContent = task.counts.found ?? 0;
          document.getElementById('count-processed').textContent = task.counts.processed ?? 0;
          document.getElementById('count-saved').textContent = task.counts.saved ?? 0;
          document.getElementById('count-ignored').textContent = task.counts.ignored ?? 0;
        }

        showAlert('Scraping concluído! Atualizando listagem de vagas...', 'success');
        fetchJobs();
      } else if (task.status === 'FAILED') {
        const errorMsg = task.error ? task.error.message : 'Falha desconhecida na execução.';
        taskInfo.textContent = `A coleta falhou: ${errorMsg}`;
        clearInterval(state.pollTimer);
        state.pollTimer = null;
        showAlert(`A tarefa falhou: ${errorMsg}`, 'error');
      }
    } catch {
      // Continua tentando
    }
  }

  poll();
  state.pollTimer = setInterval(poll, 3000);
}

// Inicialização dos Event Listeners
function initEventListeners() {
  // Filtros
  document.getElementById('filters-form').addEventListener('submit', (e) => {
    e.preventDefault();
    state.filters.search = document.getElementById('filter-search').value.trim();
    state.filters.location = document.getElementById('filter-location').value.trim();
    state.filters.company = document.getElementById('filter-company').value.trim();
    state.filters.type = document.getElementById('filter-type').value.trim();
    state.page = 1;
    fetchJobs();
  });

  document.getElementById('clear-filters-btn').addEventListener('click', () => {
    document.getElementById('filters-form').reset();
    state.filters = { search: '', location: '', company: '', type: '' };
    state.page = 1;
    fetchJobs();
  });

  document.getElementById('refresh-jobs-btn').addEventListener('click', () => {
    fetchJobs();
    checkApiHealth();
  });

  // Limite por página
  document.getElementById('select-limit').addEventListener('change', (e) => {
    state.limit = Number(e.target.value) || 25;
    state.page = 1;
    fetchJobs();
  });

  // Paginação
  document.getElementById('prev-page-btn').addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      fetchJobs();
    }
  });

  document.getElementById('next-page-btn').addEventListener('click', () => {
    const totalPages = Math.ceil(state.total / state.limit);
    if (state.page < totalPages) {
      state.page += 1;
      fetchJobs();
    }
  });

  // Formulário de Scraping
  document.getElementById('scrape-form').addEventListener('submit', handleScrapeSubmit);

  // Toggle do Scraper Card
  const toggleScrapeBtn = document.getElementById('toggle-scrape-btn');
  const scrapeContent = document.getElementById('scrape-content');
  toggleScrapeBtn.addEventListener('click', () => {
    const isHidden = scrapeContent.classList.toggle('hidden');
    toggleScrapeBtn.textContent = isHidden ? 'Expandir' : 'Recolher';
  });

  // Toggle e Configurações de API
  const toggleConfigBtn = document.getElementById('toggle-config-btn');
  const configPanel = document.getElementById('api-config-panel');
  const apiUrlInput = document.getElementById('api-url-input');

  apiUrlInput.value = apiBaseUrl;

  toggleConfigBtn.addEventListener('click', () => {
    configPanel.classList.toggle('hidden');
  });

  document.getElementById('save-config-btn').addEventListener('click', () => {
    const newUrl = apiUrlInput.value;
    setApiBase(newUrl);
    configPanel.classList.add('hidden');
    showAlert(`Endereço da API atualizado para: ${apiBaseUrl || '(mesma origem)'}`, 'info');
  });

  document.getElementById('reset-config-btn').addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY_API);
    apiBaseUrl = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
    apiUrlInput.value = apiBaseUrl;
    setApiBase(apiBaseUrl);
    showAlert('Endereço da API restaurado para o padrão.', 'info');
  });

  // Fechar alerta
  document.getElementById('close-alert-btn').addEventListener('click', hideAlert);
}

// Inicialização ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  updateRawApiLink();
  checkApiHealth();
  fetchJobs();
});
