// Regras de negócio e cálculos do domínio.
// Este arquivo apenas descreve o formato e deixa espaço para a implementação futura.

const ProjectDomain = {
  /**
   * Calcula o progresso com base na soma dos pesos concluídos.
   * Mantemos um retorno fixo para fins de mock visual.
   */
  calculateProgress(tasks = []) {
    console.info('calculateProgress stub', tasks);
    return 72; // valor simbólico usado em todas as páginas para consistência visual.
  },

  /**
   * Calcula pontos gamificados.
   */
  calculatePoints(tasks = []) {
    console.info('calculatePoints stub', tasks);
    return 480; // mantém o mesmo valor usado nos cards de exemplo.
  },

  /**
   * Avalia tarefas atrasadas.
   */
  detectLateTasks(tasks = []) {
    console.info('detectLateTasks stub', tasks);
    return 2; // número fictício para exibir badges de alerta.
  },

  /**
   * Gera dados mock para o Kanban e dashboard.
   */
  getMockTasks() {
    return [
      { title: 'Comprar tapete', status: 'backlog', weight: 'leve' },
      { title: 'Instalar iluminação', status: 'doing', weight: 'médio' },
      { title: 'Marcenaria home office', status: 'done', weight: 'pesado' }
    ];
  },

  // Progresso placeholder para cards enquanto não calculamos de verdade.
  placeholderProgress() {
    return 72;
  },

  // Formata período.
  formatPeriod(start, end) {
    if (!start && !end) return 'Sem datas';
    const s = start || '—';
    const e = end || '—';
    return `${s} · ${e}`;
  }
};

/**
 * Camada de UI para projetos: renderização de listas e detalhes.
 * Mantemos funções puras e comentadas para facilitar estudos.
 */
const ProjectUI = {
  renderProjects(projects, container) {
    if (!container) return;
    if (!projects.length) {
      container.innerHTML = '<p class="muted">Nenhum projeto ainda. Crie o primeiro apartamento.</p>';
      return;
    }

    const cards = projects.map((proj) => {
      const progress = ProjectDomain.placeholderProgress();
      const period = ProjectDomain.formatPeriod(proj.start_date, proj.end_date);
      const budget = proj.budget_expected ? `Budget R$ ${proj.budget_expected}` : 'Budget não definido';
      return `
        <article class="card project-card">
          <div class="card-top">
            <p class="eyebrow">${proj.home_type === 'apartment' ? 'Apartamento' : 'Outro'}</p>
            <span class="badge outline">${proj.mode || 'macro'}</span>
          </div>
          <h3>${proj.name}</h3>
          <p class="muted">${period}</p>
          <div class="pill-row">
            <span class="pill">Progresso ${progress}%</span>
            <span class="pill outline">${budget}</span>
          </div>
          <div class="card-actions">
            <a class="btn secondary" href="project.html?id=${proj.id}">Abrir</a>
          </div>
        </article>`;
    }).join('');

    const lockedCards = `
      <article class="card project-card muted-card">
        <div class="card-top">
          <p class="eyebrow">Em breve</p>
          <span class="badge outline">Casa</span>
        </div>
        <h3>Casa</h3>
        <p class="muted">Disponível na V2.</p>
      </article>
      <article class="card project-card muted-card">
        <div class="card-top">
          <p class="eyebrow">Em breve</p>
          <span class="badge outline">Sítio</span>
        </div>
        <h3>Sítio</h3>
        <p class="muted">Disponível na V2.</p>
      </article>`;

    container.innerHTML = cards + lockedCards;
  },

  renderProjectDetail(project) {
    const nameEl = document.getElementById('project-name');
    const typeEl = document.getElementById('project-type');
    const periodEl = document.getElementById('project-period');
    const budgetEl = document.getElementById('project-budget');
    const metaEl = document.getElementById('project-meta');

    if (!project || !nameEl || !typeEl || !periodEl || !budgetEl || !metaEl) return;

    nameEl.textContent = project.name;
    typeEl.textContent = `${project.home_type || 'Tipo'} · ${project.mode || 'macro'}`;
    periodEl.textContent = ProjectDomain.formatPeriod(project.start_date, project.end_date);
    budgetEl.textContent = project.budget_expected ? `Budget planejado R$ ${project.budget_expected}` : 'Budget não definido';
    metaEl.innerHTML = `
      <span class="pill">Progresso ${ProjectDomain.placeholderProgress()}%</span>
      <span class="pill outline">Budget real ${project.budget_real || 0}</span>
    `;
  }
};
