// Regras de negócio e UI específicas de projetos e áreas (cômodos).
// Mantemos funções pequenas e comentadas para fins didáticos.

const ProjectDomain = {
  // Progresso fictício até termos cálculo real.
  placeholderProgress() {
    return 72;
  },
  // Formata período amigável.
  formatPeriod(start, end) {
    if (!start && !end) return 'Sem datas';
    const s = start || '—';
    const e = end || '—';
    return `${s} · ${e}`;
  }
};

/**
 * Camada de UI: render de listas/detalhes.
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
            <button class="btn ghost danger" type="button" data-action="delete-project" data-project-id="${proj.id}">Excluir</button>
          </div>
        </article>`;
    }).join('');
    const locked = `
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
    container.innerHTML = cards + locked;
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
  },

  renderAreas(areas) {
    const grid = document.getElementById('areas-grid');
    if (!grid) return;
    if (!areas.length) {
      grid.innerHTML = '<p class="muted">Nenhum cômodo cadastrado ainda.</p>';
      return;
    }
    grid.innerHTML = areas.map((area) => `
      <article class="card area-card" data-area-id="${area.id}">
        <div class="card-top">
          <p class="label">${area.name}</p>
          <span class="area-kind">${area.kind}</span>
        </div>
        <p class="muted">${area.photo_cover_url ? 'Foto adicionada' : 'Sem foto'}</p>
        <div class="card-actions">
          <button class="btn ghost" type="button" data-action="edit-area" data-area-id="${area.id}">Editar</button>
          <button class="btn ghost danger" type="button" data-action="delete-area" data-area-id="${area.id}">Remover</button>
        </div>
      </article>
    `).join('');
  },

  toggleKanbanBlock(project, areas) {
    const block = document.getElementById('kanban-block');
    const tab = document.getElementById('kanban-tab');
    if (!block || !tab) return;

    const shouldBlock = project?.mode === 'macro' && areas.length < 2;
    block.classList.toggle('hidden', !shouldBlock);
    tab.disabled = shouldBlock;
    tab.classList.toggle('muted', shouldBlock);
  },

  renderKanban(tasks, areas, filterAreaId) {
    const board = document.getElementById('kanban-board');
    const empty = document.getElementById('kanban-empty');
    if (!board || !empty) return;

    const filtered = filterAreaId ? tasks.filter((t) => String(t.scope_id) === String(filterAreaId)) : tasks;
    if (!filtered.length) {
      empty.classList.remove('hidden');
      board.innerHTML = '';
      return;
    }
    empty.classList.add('hidden');

    const statuses = [
      { key: 'backlog', label: 'Backlog' },
      { key: 'doing', label: 'Fazendo' },
      { key: 'done', label: 'Feito' }
    ];

    const areaLabel = (id) => areas.find((a) => String(a.id) === String(id))?.name || 'Área';

    const cols = statuses.map((st) => {
      const items = filtered.filter((t) => t.status === st.key);
      const cards = items.map((task) => {
        const metadata = `${areaLabel(task.scope_id)} · peso ${task.weight || 'leve'} · custo ${task.cost_expected || 0}`;
        return `
          <article class="card kanban-card">
            <div class="card-top">
              <p class="label">${task.title}</p>
              <span class="badge outline">${task.task_type || 'tarefa'}</span>
            </div>
            <p class="muted">${metadata}</p>
            <div class="pill-row">
              <span class="pill">Prazo ${task.due_date || '—'}</span>
              ${task.photo_before_url && task.photo_after_url ? '<span class="pill">Fotos ok</span>' : '<span class="pill outline">Fotos pendentes</span>'}
            </div>
            <div class="card-actions">
              <button class="btn move" type="button" data-action="move-task" data-direction="left" data-task-id="${task.id}">←</button>
              <button class="btn move" type="button" data-action="move-task" data-direction="right" data-task-id="${task.id}">→</button>
            </div>
          </article>
        `;
      }).join('');

      return `
        <div class="kanban-column">
          <div class="kanban-header">
            <span>${st.label}</span>
            <span class="kanban-counter">${items.length}</span>
          </div>
          ${cards || '<div class="kanban-empty">Sem tarefas.</div>'}
        </div>
      `;
    }).join('');

    board.innerHTML = cols;
  },

  populateAreaSelects(areas) {
    const selects = [document.getElementById('taskArea'), document.getElementById('taskAreaFilter')];
    selects.forEach((sel) => {
      if (!sel) return;
      const options = ['<option value="">Selecione</option>']
        .concat(areas.map((a) => `<option value="${a.id}">${a.name}</option>`));
      sel.innerHTML = options.join('');
    });
  }
};

/**
 * Fluxos específicos da página de projeto (detalhe).
 */
const ProjectPage = {
  state: {
    project: null,
    areas: [],
    tasks: [],
    currentFilterArea: null
  },

  async init() {
    await App.requireAuth();
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('id');
    if (!projectId) {
      App.showToast('Projeto não encontrado.');
      return;
    }
    await this.loadProject(projectId);
    await this.loadAreas(projectId);
    await this.loadTasks(projectId);
    this.bindAreaForm(projectId);
    this.bindTaskForm(projectId);
    this.bindTaskFilter();
  },

  async loadProject(projectId) {
    const { data, error } = await DB.getProjectById(projectId);
    if (error || !data) {
      console.error(error);
      App.showToast('Projeto não encontrado.');
      return;
    }
    this.state.project = data;
    ProjectUI.renderProjectDetail(data);
  },

  async loadAreas(projectId) {
    const { data, error } = await DB.listAreasByProject(projectId);
    if (error) {
      console.error(error);
      App.showToast('Não foi possível carregar cômodos.');
      return;
    }
    this.state.areas = data || [];
    ProjectUI.renderAreas(this.state.areas);
    ProjectUI.toggleKanbanBlock(this.state.project, this.state.areas);
    ProjectUI.populateAreaSelects(this.state.areas);
  },

  bindAreaForm(projectId) {
    const form = document.getElementById('areaForm');
    if (!form) return;
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const name = form.name.value.trim();
      const kind = form.kind.value.trim();
      const photo = form.photo_cover_url.value.trim();
      if (!name || !kind) {
        App.showToast('Preencha nome e tipo.');
        return;
      }
      const payload = {
        project_id: projectId,
        name,
        kind,
        photo_cover_url: photo || null
      };
      const { data, error } = await DB.createArea(payload);
      if (error) {
        console.error(error);
        App.showToast('Não foi possível criar o cômodo.');
        return;
      }
      App.showToast('Cômodo criado.');
      form.reset();
      this.state.areas.unshift(data);
      ProjectUI.renderAreas(this.state.areas);
      ProjectUI.toggleKanbanBlock(this.state.project, this.state.areas);
    });
  },

  async handleDeleteArea(id, trigger) {
    const confirmed = window.confirm('Excluir cômodo?\n\nEssa ação não pode ser desfeita.');
    if (!confirmed) return;
    if (trigger) trigger.disabled = true;
    const { error } = await DB.deleteArea(id);
    if (error) {
      console.error(error);
      App.showToast('Não foi possível excluir o cômodo.');
      if (trigger) trigger.disabled = false;
      return;
    }
    this.state.areas = this.state.areas.filter((a) => String(a.id) !== String(id));
    ProjectUI.renderAreas(this.state.areas);
    ProjectUI.toggleKanbanBlock(this.state.project, this.state.areas);
    App.showToast('Cômodo removido.');
  },

  async handleEditArea(id) {
    const area = this.state.areas.find((a) => String(a.id) === String(id));
    if (!area) return;
    const newName = window.prompt('Editar nome do cômodo', area.name);
    if (!newName) return;
    const { data, error } = await DB.updateArea(id, { name: newName });
    if (error) {
      console.error(error);
      App.showToast('Não foi possível atualizar o cômodo.');
      return;
    }
    this.state.areas = this.state.areas.map((a) => (String(a.id) === String(id) ? data : a));
    ProjectUI.renderAreas(this.state.areas);
    App.showToast('Cômodo atualizado.');
    ProjectUI.populateAreaSelects(this.state.areas);
  },

  bindTaskForm(projectId) {
    const form = document.getElementById('taskForm');
    if (!form) return;
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const title = form.title.value.trim();
      const areaId = form.area.value;
      if (!title || !areaId) {
        App.showToast('Preencha título e selecione o cômodo.');
        return;
      }
      const payload = {
        project_id: projectId,
        scope_type: 'area',
        scope_id: areaId,
        title,
        task_type: form.task_type.value,
        status: 'backlog',
        weight: form.weight.value,
        due_date: form.due_date.value || null,
        cost_expected: form.cost_expected.value ? Number(form.cost_expected.value) : null
      };
      const { data, error } = await DB.createTask(payload);
      if (error) {
        console.error(error);
        App.showToast('Não foi possível criar a tarefa.');
        return;
      }
      App.showToast('Tarefa criada.');
      form.reset();
      this.state.tasks.unshift(data);
      ProjectUI.renderKanban(this.state.tasks, this.state.areas, this.currentFilterArea);
    });
  },

  bindTaskFilter() {
    const filter = document.getElementById('taskAreaFilter');
    if (!filter) return;
    filter.addEventListener('change', () => {
      this.currentFilterArea = filter.value || null;
      ProjectUI.renderKanban(this.state.tasks, this.state.areas, this.currentFilterArea);
    });
  },

  async loadTasks(projectId) {
    const { data, error } = await DB.listTasksByProject(projectId);
    if (error) {
      console.error(error);
      App.showToast('Não foi possível carregar tarefas.');
      return;
    }
    this.state.tasks = data || [];
    ProjectUI.renderKanban(this.state.tasks, this.state.areas, this.currentFilterArea);
  },

  async handleMoveTask(id, direction) {
    const order = ['backlog', 'doing', 'done'];
    const task = this.state.tasks.find((t) => String(t.id) === String(id));
    if (!task) return;
    const idx = order.indexOf(task.status);
    const nextIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= order.length) return;
    const nextStatus = order[nextIdx];

    if (nextStatus === 'done' && !(task.photo_before_url && task.photo_after_url)) {
      App.showToast('Adicione fotos antes/depois antes de concluir.');
      return;
    }

    const { data, error } = await DB.updateTaskStatus(task.id, nextStatus);
    if (error) {
      console.error(error);
      App.showToast('Não foi possível mover a tarefa.');
      return;
    }
    this.state.tasks = this.state.tasks.map((t) => (String(t.id) === String(id) ? data : t));
    ProjectUI.renderKanban(this.state.tasks, this.state.areas, this.currentFilterArea);
  }
};

// Delegação específica da página de projeto (áreas e tarefas)
document.addEventListener('click', async (event) => {
  const delAreaBtn = event.target.closest('[data-action="delete-area"]');
  if (delAreaBtn) {
    event.preventDefault();
    const id = delAreaBtn.dataset.areaId;
    await ProjectPage.handleDeleteArea(id, delAreaBtn);
    return;
  }
  const editAreaBtn = event.target.closest('[data-action="edit-area"]');
  if (editAreaBtn) {
    event.preventDefault();
    const id = editAreaBtn.dataset.areaId;
    await ProjectPage.handleEditArea(id);
  }
  const moveBtn = event.target.closest('[data-action="move-task"]');
  if (moveBtn) {
    event.preventDefault();
    const id = moveBtn.dataset.taskId;
    const dir = moveBtn.dataset.direction;
    await ProjectPage.handleMoveTask(id, dir);
  }
});
