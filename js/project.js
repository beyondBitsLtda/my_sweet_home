// Regras de negócio e UI específicas de projetos e áreas (cômodos).
// Mantemos funções pequenas e comentadas para fins didáticos e logs que ajudam a depurar o fluxo.

const ProjectDomain = {
  // Progresso fictício até termos cálculo real.
  placeholderProgress() {
    return 72;
  },
  formatDateBR(raw) {
    if (!raw) return null;
    const date = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  },
  // Formata período amigável.
  formatPeriod(start, end) {
    const startFormatted = ProjectDomain.formatDateBR(start);
    const endFormatted = ProjectDomain.formatDateBR(end);
    if (!startFormatted || !endFormatted) return 'Período · —';
    return `Período · ${startFormatted} — ${endFormatted}`;
  },
  findAreaName(areas, id) {
    return areas.find((a) => String(a.id) === String(id))?.name || 'Área';
  },
  findSubAreaName(subAreas, id) {
    return subAreas.find((a) => String(a.id) === String(id))?.name || 'Subárea';
  },
  findCornerName(corners, id) {
    return corners.find((c) => String(c.id) === String(id))?.name || 'Canto';
  },
  scopeLabel(scope, lookups) {
    if (!scope) return 'Sem escopo';
    if (scope.type === 'corner' && scope.cornerId) {
      const subName = ProjectDomain.findSubAreaName(lookups.subAreas, scope.subAreaId);
      return `Canto · ${ProjectDomain.findCornerName(lookups.corners, scope.cornerId)} (${subName})`;
    }
    if (scope.type === 'sub_area' && scope.subAreaId) {
      return `Subárea · ${ProjectDomain.findSubAreaName(lookups.subAreas, scope.subAreaId)}`;
    }
    if (scope.type === 'area' && scope.areaId) {
      return `Área · ${ProjectDomain.findAreaName(lookups.areas, scope.areaId)}`;
    }
    return 'Selecione um escopo';
  }
};

// Mapeamento único de status: garante que UI/back-end usem os mesmos valores aceitos pelo banco.
// Sempre normalizeStatus antes de gravar no Supabase.
// Mapeamento único de status: evita violar o CHECK do Postgres.
const STATUS = {
  todo: 'todo',
  'to do': 'todo',
  'to-do': 'todo',
  'a fazer': 'todo',
  backlog: 'todo',
  doing: 'doing',
  'em andamento': 'doing',
  fazendo: 'doing',
  done: 'done',
  concluido: 'done',
  concluído: 'done',
  feito: 'done',
  '': null
};

function normalizeStatus(raw) {
  const key = (raw || '').toString().trim().toLowerCase();
  return STATUS.hasOwnProperty(key) ? STATUS[key] : null;
}

// Mapeamento de peso para o CHECK tasks_weight_check.
const WEIGHT = {
  light: 'light',
  leve: 'light',
  medium: 'medium',
  medio: 'medium',
  médio: 'medium',
  normal: 'medium',
  heavy: 'heavy',
  pesado: 'heavy',
  alta: 'heavy',
  alto: 'heavy',
  '': null
};

function normalizeWeight(raw) {
  const key = (raw || '').toString().trim().toLowerCase();
  return WEIGHT.hasOwnProperty(key) ? WEIGHT[key] : null;
}

const ENTITY_COVER_PLACEHOLDER = 'assets/img/add_room.jpg';

function resolveEntityCover(entity) {
  const supabase = DB.initSupabase();
  if (entity?.cover_url) return { src: entity.cover_url, isPlaceholder: false };
  if (entity?.cover_path) {
    const { data } = supabase.storage.from('home-covers').getPublicUrl(entity.cover_path);
    if (data?.publicUrl) return { src: data.publicUrl, isPlaceholder: false };
  }
  return { src: ENTITY_COVER_PLACEHOLDER, isPlaceholder: true };
}

function buildEntityCoverHTML({ src, isPlaceholder, entityType, entityId, alt, size = 'default' }) {
  const sizeClass = size === 'compact' ? 'is-compact' : size === 'tight' ? 'is-tight' : '';
  const overlayText = isPlaceholder
    ? `
      <span class="entity-cover-overlay__text">Imagem placeholder</span>
      <span class="entity-cover-overlay__text subtle">Clique para escolher uma capa</span>
    `
    : `<span class="entity-cover-overlay__text">Trocar capa</span>`;

  return `
    <figure class="entity-cover-frame ${sizeClass} ${isPlaceholder ? 'is-placeholder' : ''}" data-action="pick-entity-cover" data-entity-type="${entityType}" data-entity-id="${entityId}">
      <img class="entity-cover-img" src="${src}" alt="${alt}" loading="lazy" />
      <div class="entity-cover-overlay">
        ${overlayText}
      </div>
    </figure>
  `;
}

function getWeightValue(raw) {
  const normalized = normalizeWeight(raw) || 'medium';
  if (normalized === 'light') return 1;
  if (normalized === 'heavy') return 3;
  return 2; // medium default
}

function computeProjectProgress(tasks) {
  const normalized = (tasks || []).map((t) => ({
    status: normalizeStatus(t.status) || 'todo',
    weight: getWeightValue(t.weight)
  }));
  const W = normalized.reduce((sum, t) => sum + t.weight, 0);
  if (!W) return { W: 0, progressPercent: 0 };
  const doneWeight = normalized
    .filter((t) => t.status === 'done')
    .reduce((sum, t) => sum + t.weight, 0);
  const progressPercent = Number(((doneWeight / W) * 100).toFixed(1));
  return { W, progressPercent };
}

function computeProjectPoints(tasks) {
  return (tasks || []).reduce((sum, task) => {
    const status = normalizeStatus(task.status) || 'todo';
    const w = getWeightValue(task.weight);
    const hasPhotos = Boolean(task.has_photo_before) && Boolean(task.has_photo_after);
    if (status === 'done' && hasPhotos) {
      return sum + 80 * w;
    }
    return sum;
  }, 0);
}

function computeDeadlineIndicators(project, tasks) {
  const today = new Date();
  const endDate = project?.end_date ? new Date(project.end_date) : null;
  let overdueCount = 0;
  let beyondEndCount = 0;
  (tasks || []).forEach((task) => {
    const status = normalizeStatus(task.status) || 'todo';
    if (!task.due_date) return;
    const due = new Date(task.due_date);
    if (status !== 'done' && due < today) overdueCount += 1;
    if (endDate && due > endDate) beyondEndCount += 1;
  });
  return { overdueCount, beyondEndCount };
}

function computeBudgetIndicators(tasks) {
  const sumExpected = (tasks || []).reduce((sum, t) => sum + Number(t.cost_expected || 0), 0);
  const sumReal = (tasks || []).reduce((sum, t) => sum + Number(t.cost_real || 0), 0);
  return { sumExpected, sumReal, isOverBudget: sumReal > sumExpected };
}

const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatCurrencyBRL(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return null;
  return BRL_FORMATTER.format(parsed);
}

function loadPointsLedger(userId, projectId) {
  const key = `msh_points_${userId}_${projectId}`;
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch (e) {
    console.warn('Não foi possível ler ledger de pontos', e);
    return {};
  }
}

function savePointsLedger(userId, projectId, ledger) {
  const key = `msh_points_${userId}_${projectId}`;
  localStorage.setItem(key, JSON.stringify(ledger));
}

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
    const cards = projects
      .map((proj) => {
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
      })
      .join('');
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

  async renderProjectDetail(project) {
    const nameEl = document.getElementById('project-name');
    const typeEl = document.getElementById('project-type');
    const periodEl = document.getElementById('project-period');
    const budgetEl = document.getElementById('project-budget');
    const coverImg = document.getElementById('project-cover-img');
    const coverShell = document.getElementById('project-cover-shell');
    const coverOverlayText = document.getElementById('project-cover-placeholder-text');
    if (!project || !nameEl || !typeEl || !periodEl || !budgetEl) return;

    nameEl.textContent = project.name;
    typeEl.textContent = `${project.home_type || 'Tipo'} · ${project.mode || 'macro'}`;
    periodEl.textContent = ProjectDomain.formatPeriod(project.start_date, project.end_date);
    const formattedBudget = formatCurrencyBRL(project.budget_expected);
    budgetEl.textContent = formattedBudget ? `Budget planejado ${formattedBudget}` : 'Budget não definido';
    ProjectUI.renderHeroIndicators({
      progressPercent: null,
      budgetExpected: project.budget_expected,
      budgetReal: project.budget_real
    });

    if (coverImg) {
      coverImg.alt = `Capa do projeto ${project.name || ''}`.trim();
      let coverSrc = project.cover_url || null;
      if (!coverSrc && project.cover_path) {
        coverSrc = await DB.getProjectCoverUrl(project);
      }
      if (!coverSrc) {
        coverSrc = 'assets/img/project_placeholder.jpg';
      }
      coverImg.src = coverSrc;
      coverImg.classList.remove('hidden');
    }
    const isPlaceholder = !project.cover_url && !project.cover_path;
    if (coverShell) {
      coverShell.classList.toggle('is-placeholder', isPlaceholder);
    }
    if (coverOverlayText) {
      coverOverlayText.textContent = isPlaceholder ? 'Imagem placeholder' : 'Clique para trocar a capa';
    }
  },

  renderHeroIndicators({ progressPercent, budgetExpected, budgetReal } = {}) {
    const meta = document.getElementById('project-meta');
    if (!meta) return;
    const hasProgress = typeof progressPercent === 'number' && !Number.isNaN(progressPercent);
    const cappedProgress = hasProgress ? Math.min(Math.max(progressPercent, 0), 100) : 0;
    const progressLabel = hasProgress ? `${progressPercent}%` : '—%';
    const formattedExpected = formatCurrencyBRL(budgetExpected);
    const formattedReal = formatCurrencyBRL(budgetReal);
    const plannedLabel = formattedExpected ? `Orçado: ${formattedExpected}` : 'Orçado: —';
    const spentNumber = Number(budgetReal);
    const expectedNumber = Number(budgetExpected);
    const isOverBudget =
      !Number.isNaN(spentNumber) && !Number.isNaN(expectedNumber) && expectedNumber !== 0 && spentNumber > expectedNumber;
    const spentLabel = formattedReal ? `Gasto: ${formattedReal}` : 'Gasto: —';

    meta.innerHTML = `
      <div class="meta-progress">
        <p class="eyebrow subtle-text">Progresso · <span class="meta-progress__value">${progressLabel}</span></p>
        <div class="meta-progress__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${cappedProgress}">
          <span style="width: ${cappedProgress}%"></span>
        </div>
      </div>
      <div class="meta-budget">
        <p class="muted small budget-line">${plannedLabel}</p>
        <p class="muted small budget-line ${isOverBudget ? 'budget-over' : ''}">${spentLabel}</p>
      </div>
    `;
  },

  renderAreas(areas) {
    const grid = document.getElementById('areas-grid');
    if (!grid) return;
    if (!areas.length) {
      grid.innerHTML = '<p class="muted">Nenhum cômodo cadastrado ainda.</p>';
      return;
    }
    grid.innerHTML = areas
      .map((area) => {
        const cover = resolveEntityCover(area);
        const coverHTML = buildEntityCoverHTML({
          src: cover.src,
          isPlaceholder: cover.isPlaceholder,
          entityType: 'areas',
          entityId: area.id,
          alt: `Capa do cômodo ${area.name}`
        });
        return `
      <article class="card area-card" data-area-id="${area.id}">
        <div class="area-cover-shell">
          ${coverHTML}
        </div>
        <div class="card-top">
          <div>
            <p class="label">${area.name}</p>
            <p class="muted">${area.photo_cover_url ? 'Foto adicionada' : 'Sem foto'}</p>
          </div>
          <div class="pill-row slim">
            <span class="pill soft">${area.kind || 'Cômodo'}</span>
            <button class="btn ghost tiny" type="button" data-action="toggle-area-manage" data-area-id="${area.id}">Gerenciar</button>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn ghost" type="button" data-action="edit-area" data-area-id="${area.id}">Editar</button>
          <button class="btn ghost danger" type="button" data-action="delete-area" data-area-id="${area.id}">Remover</button>
        </div>
        <div class="manage-panel hidden" data-area-panel="${area.id}">
          <div class="manage-header">
            <div>
              <p class="label">Subáreas</p>
              <p class="muted">Divida o cômodo em subpartes e gerencie cantos.</p>
            </div>
            <span class="badge outline">Nível 2</span>
          </div>
          <div class="subarea-list" data-subarea-list="${area.id}"></div>
          <form class="inline-form" data-action="create-sub-area" data-area-id="${area.id}">
            <input class="input compact-input" name="name" placeholder="Nome da subárea" required />
            <input class="input compact-input" name="description" placeholder="Descrição opcional" />
            <button class="btn ghost tiny" type="submit">Adicionar subárea</button>
          </form>
        </div>
      </article>
    `;
      })
      .join('');
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

  renderSubAreas(areaId, subAreas, corners) {
    const list = document.querySelector(`[data-subarea-list="${areaId}"]`);
    if (!list) return;
    const scoped = subAreas.filter((sa) => String(sa.area_id) === String(areaId));
    if (!scoped.length) {
      list.innerHTML = `<div class="empty muted">Nenhuma subárea. Comece adicionando uma divisão.</div>`;
      return;
    }

    list.innerHTML = scoped
      .map((sa) => {
        const subAreaCover = resolveEntityCover(sa);
        const cornersForSub = corners.filter((c) => String(c.sub_area_id) === String(sa.id));
        const cornersList = cornersForSub
          .map(
            (c) => {
              const cornerCover = resolveEntityCover(c);
              return `
              <div class="nested-row">
                <div class="corner-cover">
                  ${buildEntityCoverHTML({
                    src: cornerCover.src,
                    isPlaceholder: cornerCover.isPlaceholder,
                    entityType: 'corners',
                    entityId: c.id,
                    alt: \`Capa do canto ${c.name}\`,
                    size: 'tight'
                  })}
                </div>
                <div>
                  <p class="label">${c.name}</p>
                  <p class="muted">${c.description || 'Sem descrição'}</p>
                </div>
                <div class="inline-actions">
                  <span class="badge ghost">Canto</span>
                  <button class="btn ghost tiny" data-action="edit-corner" data-corner-id="${c.id}">Editar</button>
                  <button class="btn ghost danger tiny" data-action="delete-corner" data-corner-id="${c.id}">Remover</button>
                </div>
              </div>
            `;
            }
          )
          .join('');

        return `
          <article class="nested-card" data-sub-area-id="${sa.id}">
            <div class="nested-cover">
              ${buildEntityCoverHTML({
                src: subAreaCover.src,
                isPlaceholder: subAreaCover.isPlaceholder,
                entityType: 'subareas',
                entityId: sa.id,
                alt: \`Capa da subárea ${sa.name}\`,
                size: 'compact'
              })}
            </div>
            <div class="nested-row">
              <div>
                <p class="label">${sa.name}</p>
                <p class="muted">${sa.description || 'Sem descrição'}</p>
              </div>
              <div class="inline-actions">
                <span class="badge ghost">Subárea</span>
                <button class="btn ghost tiny" data-action="edit-sub-area" data-sub-area-id="${sa.id}">Editar</button>
                <button class="btn ghost danger tiny" data-action="delete-sub-area" data-sub-area-id="${sa.id}">Remover</button>
                <button class="btn ghost tiny" data-action="toggle-corners" data-sub-area-id="${sa.id}">Ver cantos</button>
              </div>
            </div>
            <div class="corner-panel hidden" data-corner-panel="${sa.id}">
              <div class="muted small">Cantos dentro desta subárea</div>
              <div class="corner-list" data-corner-list="${sa.id}">
                ${cornersList || '<div class="empty muted">Nenhum canto ainda.</div>'}
              </div>
              <form class="inline-form" data-action="create-corner" data-sub-area-id="${sa.id}">
                <input class="input compact-input" name="name" placeholder="Nome do canto" required />
                <input class="input compact-input" name="description" placeholder="Descrição opcional" />
                <button class="btn ghost tiny" type="submit">Adicionar canto</button>
              </form>
            </div>
          </article>
        `;
      })
      .join('');
  },

  populateScopeSelectors(areas, subAreas, corners, scope) {
    const typeSel = document.getElementById('scopeTypeSelect');
    const areaSel = document.getElementById('scopeAreaSelect');
    const subAreaSel = document.getElementById('scopeSubAreaSelect');
    const cornerSel = document.getElementById('scopeCornerSelect');
    if (!typeSel || !areaSel || !subAreaSel || !cornerSel) return;

    typeSel.value = scope.type;

    // Área
    const areaOptions = ['<option value="">Selecione a área</option>'].concat(
      areas.map((a) => `<option value="${a.id}">${a.name}</option>`)
    );
    areaSel.innerHTML = areaOptions.join('');
    areaSel.value = scope.areaId || '';

    // Subárea filtrada pela área
    const subAreaOptions = ['<option value="">Selecione a subárea</option>'].concat(
      subAreas
        .filter((sa) => String(sa.area_id) === String(scope.areaId))
        .map((sa) => `<option value="${sa.id}">${sa.name}</option>`)
    );
    subAreaSel.innerHTML = subAreaOptions.join('');
    subAreaSel.disabled = scope.type === 'area' || !scope.areaId;
    subAreaSel.value = scope.subAreaId || '';

    // Canto filtrado pela subárea
    const cornerOptions = ['<option value="">Selecione o canto</option>'].concat(
      corners
        .filter((c) => String(c.sub_area_id) === String(scope.subAreaId))
        .map((c) => `<option value="${c.id}">${c.name}</option>`)
    );
    cornerSel.innerHTML = cornerOptions.join('');
    cornerSel.disabled = scope.type !== 'corner' || !scope.subAreaId;
    cornerSel.value = scope.cornerId || '';
  },

  renderScopeSummary(scope, lookups) {
    const summary = document.getElementById('scopeSummary');
    if (!summary) return;
    summary.textContent = ProjectDomain.scopeLabel(scope, lookups);
  },

  renderKanban(tasks, lookups) {
    const board = document.getElementById('kanban-board');
    const empty = document.getElementById('kanban-empty');
    if (!board || !empty) return;

    const scopeId = lookups.scopeId;

    if (!scopeId) {
      empty.classList.remove('hidden');
      empty.querySelector('.empty-text').textContent = 'Selecione um escopo para carregar tarefas.';
      board.innerHTML = '';
      return;
    }

    if (!tasks.length) {
      empty.classList.remove('hidden');
      empty.querySelector('.empty-text').textContent = 'Nenhuma tarefa neste escopo ainda.';
      board.innerHTML = '';
      return;
    }
    empty.classList.add('hidden');

    const statuses = [
      { key: 'todo', label: 'Backlog' },
      { key: 'doing', label: 'Fazendo' },
      { key: 'done', label: 'Feito' }
    ];

    const cols = statuses
      .map((st) => {
        const items = tasks.filter((t) => t.status === st.key);
        const cards = items
          .map((task) => {
            const scopeBadge = (() => {
              if (task.scope_type === 'corner') {
                const cornerInfo = lookups.corners.find((c) => String(c.id) === String(task.scope_id));
                const subName = cornerInfo
                  ? ProjectDomain.findSubAreaName(lookups.subAreas, cornerInfo.sub_area_id)
                  : 'Subárea';
                return `${cornerInfo?.name || ProjectDomain.findCornerName(lookups.corners, task.scope_id)} · ${subName}`;
              }
              if (task.scope_type === 'sub_area') {
                return ProjectDomain.findSubAreaName(lookups.subAreas, task.scope_id);
              }
              return ProjectDomain.findAreaName(lookups.areas, task.scope_id);
            })();
            const metadata = `${scopeBadge} · peso ${task.weight || 'leve'} · custo ${task.cost_expected || 0}`;
        const hasPhotos = task.has_photo_before || task.photo_before_url;
        const hasAfter = task.has_photo_after || task.photo_after_url;
            return `
              <article class="card kanban-card">
                <div class="card-top">
                  <p class="label">${task.title}</p>
                  <span class="badge outline">${task.task_type || 'tarefa'}</span>
                </div>
                <p class="muted">${metadata}</p>
                <div class="pill-row">
                  <span class="pill">Prazo ${task.due_date || '—'}</span>
                  <span class="pill ${hasPhotos ? '' : 'outline'}">Antes ${hasPhotos ? '✓' : '✗'}</span>
                  <span class="pill ${hasAfter ? '' : 'outline'}">Depois ${hasAfter ? '✓' : '✗'}</span>
                </div>
                <div class="card-actions">
                  <button class="btn ghost tiny" type="button" data-action="open-photos" data-task-id="${task.id}">Fotos</button>
                  <button class="btn move" type="button" data-action="move-task" data-direction="left" data-task-id="${task.id}">←</button>
                  <button class="btn move" type="button" data-action="move-task" data-direction="right" data-task-id="${task.id}">→</button>
                </div>
              </article>
            `;
          })
          .join('');

        return `
          <div class="kanban-column">
            <div class="kanban-header">
              <span>${st.label}</span>
              <span class="kanban-counter">${items.length}</span>
            </div>
            ${cards || '<div class="kanban-empty">Sem tarefas.</div>'}
          </div>
        `;
      })
      .join('');

    board.innerHTML = cols;
  }
};

/**
 * Fluxos específicos da página de projeto (detalhe).
 */
const ProjectPage = {
  state: {
    projectId: null,
    project: null,
    projectTasks: [],
    areas: [],
    subAreas: [],
    corners: [],
    tasks: [],
    scopeSelection: {
      type: 'area',
      areaId: null,
      subAreaId: null,
      cornerId: null
    },
    coverUploadContext: null,
    entityCoverInput: null,
    photoModal: {
      taskId: null,
      beforePreview: null,
      afterPreview: null
    }
  },

  async init() {
    await App.requireAuth();
    const projectId = new URLSearchParams(window.location.search).get('id');
    this.state.projectId = projectId;
    const projectUI = document.querySelector('#projectUI') || document.querySelector('[data-project-ui]');
    if (!projectUI) {
      console.error('Container do projeto não encontrado (#projectUI).');
      return;
    }

    if (!projectId) {
      projectUI.innerHTML = `
        <div class="card">
          <p class="eyebrow">Projeto inválido</p>
          <h3>Projeto inválido ou link incompleto</h3>
          <p class="muted">Reabra a partir da lista de projetos.</p>
          <a class="btn primary" href="app.html">Voltar para projetos</a>
        </div>`;
      return;
    }

    const { data: project, error } = await DB.getProjectById(projectId);
    if (error || !project) {
      console.error('Erro ao carregar projeto', error);
      projectUI.innerHTML = `
        <div class="card">
          <p class="eyebrow">Erro</p>
          <h3>Não foi possível carregar o projeto</h3>
          <p class="muted">Tente novamente ou volte para projetos.</p>
          <a class="btn primary" href="app.html">Voltar para projetos</a>
        </div>`;
      return;
    }

    this.state.project = project;
    await ProjectUI.renderProjectDetail(project);

    await this.loadAreas(projectId);
    await this.hydrateSubAreasAndCorners();
    this.bootstrapScope();
    await this.loadTasks(projectId);
    this.bindAreaForm(projectId);
    this.bindTaskForm(projectId);
    this.bindAddRoomCard();
    this.bindScopeSelectors();

    const coverShell = document.getElementById('project-cover-shell');
    const coverUpload = document.getElementById('project-cover-upload');
    if (coverShell && coverUpload) {
      coverShell.addEventListener('click', () => coverUpload.click());
      coverUpload.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (file) {
          await this.handleCoverChange(file);
          coverUpload.value = '';
        }
      });
    }
  },

  async loadProject(projectId) {
    const { data, error } = await DB.getProjectById(projectId);
    if (error || !data) {
      console.error(error);
      App.showToast('Projeto não encontrado.');
      return;
    }
    this.state.project = data;
    await ProjectUI.renderProjectDetail(data);
  },

  async handleCoverChange(file) {
    if (!file) return;
    const userId = App.state.user?.id;
    const projectId = this.state.project?.id || this.state.projectId;
    if (!userId || !projectId) {
      App.showToast('Não foi possível identificar o projeto.');
      return;
    }
    const prev = { ...this.state.project };
    const { data: uploadData, error: uploadError } = await DB.uploadProjectCover(userId, projectId, file);
    if (uploadError || !uploadData) {
      console.error('Erro ao enviar capa', uploadError);
      App.showToast('Não foi possível enviar a capa. Tente novamente.');
      return;
    }

    const { data: updated, error: updateError } = await DB.updateProjectCover(
      projectId,
      userId,
      uploadData.cover_url,
      uploadData.cover_path
    );
    if (updateError) {
      console.error('Erro ao salvar capa', updateError);
      App.showToast('Não foi possível salvar a capa. Tente novamente.');
      return;
    }

    const newCoverUrl = updated?.cover_url || uploadData.cover_url || null;
    const newCoverPath = updated?.cover_path || uploadData.cover_path || null;
    this.state.project = {
      ...prev,
      ...updated,
      cover_url: newCoverUrl,
      cover_path: newCoverPath
    };
    await ProjectUI.renderProjectDetail(this.state.project);
    App.showToast('Capa atualizada.');
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
  },

  async hydrateSubAreasAndCorners() {
    // Carrega subáreas para cada área e na sequência carrega cantos para cada subárea.
    const subAreasResults = await Promise.all(
      this.state.areas.map((area) => DB.listSubAreasByArea(area.id))
    );
    subAreasResults.forEach((res) => {
      if (res.error) console.error('Erro ao carregar subáreas', res.error);
    });
    this.state.subAreas = subAreasResults.flatMap((res) => res.data || []);

    const cornerResults = await Promise.all(
      this.state.subAreas.map((sa) => DB.listCornersBySubArea(sa.id))
    );
    cornerResults.forEach((res) => {
      if (res.error) console.error('Erro ao carregar cantos', res.error);
    });
    this.state.corners = cornerResults.flatMap((res) => res.data || []);

    // Renderiza a camada nested.
    this.state.areas.forEach((area) => {
      ProjectUI.renderSubAreas(area.id, this.state.subAreas, this.state.corners);
    });
  },

  bootstrapScope() {
    // Seleciona a primeira área disponível por padrão.
    if (!this.state.scopeSelection.areaId && this.state.areas.length) {
      this.state.scopeSelection.areaId = this.state.areas[0].id;
    }
    ProjectUI.populateScopeSelectors(
      this.state.areas,
      this.state.subAreas,
      this.state.corners,
      this.state.scopeSelection
    );
    ProjectUI.renderScopeSummary(this.state.scopeSelection, this.lookups());
  },

  lookups() {
    return {
      areas: this.state.areas,
      subAreas: this.state.subAreas,
      corners: this.state.corners
    };
  },

  ensureEntityCoverInput() {
    if (this.state.entityCoverInput) return this.state.entityCoverInput;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.id = 'entity-cover-upload';
    input.hidden = true;
    input.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      const ctx = this.state.coverUploadContext;
      if (file && ctx?.entityType && ctx?.entityId) {
        await this.handleEntityCoverUpload(ctx.entityType, ctx.entityId, file);
      }
      input.value = '';
      this.state.coverUploadContext = null;
    });
    document.body.appendChild(input);
    this.state.entityCoverInput = input;
    return input;
  },

  openCoverFileSelector(entityType, entityId) {
    if (!entityType || !entityId) return;
    this.state.coverUploadContext = { entityType, entityId };
    const input = this.ensureEntityCoverInput();
    if (!input) return;
    input.value = '';
    input.click();
  },

  async handleEntityCoverUpload(entityType, entityId, file) {
    if (!file) return;
    const userId = App.state.user?.id;
    const projectId = this.state.project?.id || this.state.projectId;
    if (!userId || !projectId) {
      App.showToast('Sessão expirada. Reabra o projeto.');
      return;
    }

    const { data: uploadData, error: uploadError } = await DB.uploadEntityCover({
      userId,
      projectId,
      entityType,
      entityId,
      file
    });
    if (uploadError || !uploadData) {
      console.error('Erro ao enviar capa', uploadError);
      App.showToast('Erro ao enviar capa');
      return;
    }

    let updateResult = null;
    const entityKey = String(entityType || '').toLowerCase();
    if (entityKey === 'areas') {
      updateResult = await DB.updateAreaCover(entityId, uploadData.cover_path, uploadData.cover_url);
    } else if (entityKey === 'subareas') {
      updateResult = await DB.updateSubareaCover(entityId, uploadData.cover_path, uploadData.cover_url);
    } else if (entityKey === 'corners') {
      updateResult = await DB.updateCornerCover(entityId, uploadData.cover_path, uploadData.cover_url);
    } else {
      App.showToast('Tipo de capa inválido.');
      return;
    }

    if (!updateResult) return;
    const { data, error } = updateResult;
    if (error) {
      console.error('Erro ao salvar capa', error);
      App.showToast('Imagem enviada, mas não vinculada (verifique colunas cover_path/cover_url e RLS)');
      return;
    }

    const nextCover = {
      cover_url: data?.cover_url || uploadData.cover_url || null,
      cover_path: data?.cover_path || uploadData.cover_path || null
    };

    if (entityKey === 'areas') {
      this.state.areas = this.state.areas.map((area) =>
        String(area.id) === String(entityId) ? { ...area, ...data, ...nextCover } : area
      );
      ProjectUI.renderAreas(this.state.areas);
      this.state.areas.forEach((area) => ProjectUI.renderSubAreas(area.id, this.state.subAreas, this.state.corners));
    }

    if (entityKey === 'subareas') {
      const parentAreaId = this.findAreaIdBySubArea(entityId);
      this.state.subAreas = this.state.subAreas.map((sa) =>
        String(sa.id) === String(entityId) ? { ...sa, ...data, ...nextCover } : sa
      );
      if (parentAreaId) {
        ProjectUI.renderSubAreas(parentAreaId, this.state.subAreas, this.state.corners);
      }
    }

    if (entityKey === 'corners') {
      const targetCorner = this.state.corners.find((c) => String(c.id) === String(entityId));
      const parentSubAreaId = targetCorner?.sub_area_id || data?.sub_area_id || null;
      this.state.corners = this.state.corners.map((c) =>
        String(c.id) === String(entityId) ? { ...c, ...data, ...nextCover } : c
      );
      if (parentSubAreaId) {
        const parentAreaId = this.findAreaIdBySubArea(parentSubAreaId);
        if (parentAreaId) {
          ProjectUI.renderSubAreas(parentAreaId, this.state.subAreas, this.state.corners);
        }
      }
    }

    App.showToast('Capa atualizada.');
  },

  currentScopeFilter() {
    const { type, areaId, subAreaId, cornerId } = this.state.scopeSelection;
    if (type === 'corner' && cornerId) return { scope_type: 'corner', scope_id: cornerId };
    if (type === 'sub_area' && subAreaId) return { scope_type: 'sub_area', scope_id: subAreaId };
    if (type === 'area' && areaId) return { scope_type: 'area', scope_id: areaId };
    return { scope_type: null, scope_id: null };
  },

  applyScopeFilter() {
    const filter = this.currentScopeFilter();
    const subset = filter.scope_id
      ? this.state.projectTasks.filter((t) => t.scope_id && String(t.scope_id) === String(filter.scope_id))
      : this.state.projectTasks;
    this.state.tasks = subset;
    ProjectUI.renderKanban(this.state.tasks, {
      ...this.lookups(),
      scopeId: filter.scope_id
    });
  },

  updateDashboard() {
    const grid = document.getElementById('dashboard-grid');
    const empty = document.getElementById('dashboard-empty');
    if (!grid || !empty) return;

    const tasks = this.state.projectTasks || [];
    if (!tasks.length) {
      empty.classList.remove('hidden');
      grid.innerHTML = '';
      return;
    }
    empty.classList.add('hidden');

    const progress = computeProjectProgress(tasks);
    const points = computeProjectPoints(tasks);
    const deadlines = computeDeadlineIndicators(this.state.project, tasks);
    const budget = computeBudgetIndicators(tasks);
    ProjectUI.renderHeroIndicators({
      progressPercent: progress.progressPercent,
      budgetExpected: this.state.project?.budget_expected,
      budgetReal: this.state.project?.budget_real
    });

    const cards = [
      { label: 'Progresso do projeto', value: `${progress.progressPercent}%`, caption: `Peso total ${progress.W}` },
      { label: 'Pontos', value: points, caption: '80 × peso (tarefas concluídas com fotos)' },
      { label: 'Tarefas atrasadas', value: deadlines.overdueCount, caption: 'Hoje > due_date e status != done' },
      {
        label: 'Prazos após término',
        value: deadlines.beyondEndCount,
        caption: this.state.project?.end_date ? `Due > ${this.state.project.end_date}` : 'Projeto sem data final'
      },
      {
        label: 'Orçado × Real',
        value: `R$ ${Number(budget.sumExpected || 0).toFixed(2)} / R$ ${Number(budget.sumReal || 0).toFixed(2)}`,
        caption: 'Somatório em runtime (não persiste em projects)'
      },
      {
        label: 'Orçamento estourado',
        value: budget.isOverBudget ? 'Sim' : 'Não',
        caption: budget.isOverBudget ? 'Real > Orçado' : 'Dentro do orçado'
      }
    ];

    grid.innerHTML = cards
      .map(
        (card) => `
        <article class="card metric-card">
          <p class="eyebrow">${card.label}</p>
          <h2>${card.value}</h2>
          <p class="muted small">${card.caption}</p>
        </article>
      `
      )
      .join('');
  },

  async loadTasks(projectId) {
    const { data, error } = await DB.listTasksByProject(projectId);
    if (error) {
      console.error(error);
      App.showToast('Não foi possível carregar tarefas.');
      return;
    }
    this.state.projectTasks = (data || []).map((task) => ({
      ...task,
      status: normalizeStatus(task.status) || 'todo',
      weight: normalizeWeight(task.weight) || 'medium'
    }));
    this.applyScopeFilter();
    this.updateDashboard();
  },

  bindAreaForm(projectId) {
    const form = document.getElementById('areaForm');
    const formCard = document.getElementById('area-form-card');
    const cancelBtn = form?.querySelector('[data-action="cancel-area-form"]');
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
      await this.hydrateSubAreasAndCorners();
      ProjectUI.toggleKanbanBlock(this.state.project, this.state.areas);

      // Ajusta escopo default para o novo cômodo se nenhum estava selecionado.
      if (!this.state.scopeSelection.areaId) {
        this.state.scopeSelection.areaId = data.id;
        this.syncScopeUI();
      }
      this.hideAreaForm();
    });

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.hideAreaForm());
    }
    if (formCard) {
      formCard.addEventListener('transitionend', () => {
        if (formCard.classList.contains('hidden')) {
          formCard.setAttribute('aria-hidden', 'true');
        }
      });
    }
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
    this.state.subAreas = this.state.subAreas.filter((sa) => String(sa.area_id) !== String(id));
    this.state.corners = this.state.corners.filter((c) =>
      this.state.subAreas.some((sa) => String(sa.id) === String(c.sub_area_id))
    );
    ProjectUI.renderAreas(this.state.areas);
    this.state.areas.forEach((area) => ProjectUI.renderSubAreas(area.id, this.state.subAreas, this.state.corners));
    ProjectUI.toggleKanbanBlock(this.state.project, this.state.areas);
    this.resetScopeIfInvalid();
    await this.loadTasks(this.state.project.id);
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
    this.state.areas.forEach((areaItem) =>
      ProjectUI.renderSubAreas(areaItem.id, this.state.subAreas, this.state.corners)
    );
    this.syncScopeUI();
    App.showToast('Cômodo atualizado.');
  },

  async handleCreateSubArea(form) {
    const areaId = form.dataset.areaId;
    const name = form.name.value.trim();
    if (!name) {
      App.showToast('Informe um nome para a subárea.');
      return;
    }
    const { data, error } = await DB.createSubArea({
      area_id: areaId,
      name,
      description: form.description.value.trim() || null
    });
    if (error) {
      console.error(error);
      App.showToast('Não foi possível criar a subárea.');
      return;
    }
    form.reset();
    this.state.subAreas.unshift(data);
    ProjectUI.renderSubAreas(areaId, this.state.subAreas, this.state.corners);
    this.syncScopeUI();
    App.showToast('Subárea adicionada.');
  },

  async handleEditSubArea(id) {
    const subArea = this.state.subAreas.find((sa) => String(sa.id) === String(id));
    if (!subArea) return;
    const newName = window.prompt('Editar subárea', subArea.name);
    if (!newName) return;
    const { data, error } = await DB.updateSubArea(id, { name: newName });
    if (error) {
      console.error(error);
      App.showToast('Não foi possível atualizar a subárea.');
      return;
    }
    this.state.subAreas = this.state.subAreas.map((sa) => (String(sa.id) === String(id) ? data : sa));
    ProjectUI.renderSubAreas(subArea.area_id, this.state.subAreas, this.state.corners);
    this.syncScopeUI();
    App.showToast('Subárea atualizada.');
  },

  async handleDeleteSubArea(id) {
    const subArea = this.state.subAreas.find((sa) => String(sa.id) === String(id));
    if (!subArea) return;
    const confirmed = window.confirm('Remover subárea e seus cantos?');
    if (!confirmed) return;
    const { error } = await DB.deleteSubArea(id);
    if (error) {
      console.error(error);
      App.showToast('Não foi possível remover a subárea.');
      return;
    }
    this.state.subAreas = this.state.subAreas.filter((sa) => String(sa.id) !== String(id));
    this.state.corners = this.state.corners.filter((c) => String(c.sub_area_id) !== String(id));
    ProjectUI.renderSubAreas(subArea.area_id, this.state.subAreas, this.state.corners);
    this.resetScopeIfInvalid();
    await this.loadTasks(this.state.project.id);
    this.syncScopeUI();
    App.showToast('Subárea removida.');
  },

  async handleCreateCorner(form) {
    const subAreaId = form.dataset.subAreaId;
    const name = form.name.value.trim();
    if (!name) {
      App.showToast('Informe um nome para o canto.');
      return;
    }
    const { data, error } = await DB.createCorner({
      sub_area_id: subAreaId,
      name,
      description: form.description.value.trim() || null
    });
    if (error) {
      console.error(error);
      App.showToast('Não foi possível criar o canto.');
      return;
    }
    form.reset();
    this.state.corners.unshift(data);
    ProjectUI.renderSubAreas(this.findAreaIdBySubArea(subAreaId), this.state.subAreas, this.state.corners);
    this.syncScopeUI();
    App.showToast('Canto adicionado.');
  },

  async handleEditCorner(id) {
    const corner = this.state.corners.find((c) => String(c.id) === String(id));
    if (!corner) return;
    const newName = window.prompt('Editar canto', corner.name);
    if (!newName) return;
    const { data, error } = await DB.updateCorner(id, { name: newName });
    if (error) {
      console.error(error);
      App.showToast('Não foi possível atualizar o canto.');
      return;
    }
    this.state.corners = this.state.corners.map((c) => (String(c.id) === String(id) ? data : c));
    ProjectUI.renderSubAreas(this.findAreaIdBySubArea(corner.sub_area_id), this.state.subAreas, this.state.corners);
    this.syncScopeUI();
    App.showToast('Canto atualizado.');
  },

  async handleDeleteCorner(id) {
    const corner = this.state.corners.find((c) => String(c.id) === String(id));
    if (!corner) return;
    const confirmed = window.confirm('Remover canto?');
    if (!confirmed) return;
    const { error } = await DB.deleteCorner(id);
    if (error) {
      console.error(error);
      App.showToast('Não foi possível remover o canto.');
      return;
    }
    this.state.corners = this.state.corners.filter((c) => String(c.id) !== String(id));
    ProjectUI.renderSubAreas(this.findAreaIdBySubArea(corner.sub_area_id), this.state.subAreas, this.state.corners);
    this.resetScopeIfInvalid();
    await this.loadTasks(this.state.project.id);
    this.syncScopeUI();
    App.showToast('Canto removido.');
  },

  findAreaIdBySubArea(subAreaId) {
    return this.state.subAreas.find((sa) => String(sa.id) === String(subAreaId))?.area_id;
  },

  bindTaskForm(projectId) {
    const form = document.getElementById('taskForm');
    if (!form) return;
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const title = form.title.value.trim();
      if (!title) {
        App.showToast('Preencha o título da tarefa.');
        return;
      }

      const filter = this.currentScopeFilter();
      if (!filter.scope_type || !filter.scope_id) {
        App.showToast('Escolha um escopo antes de criar tarefas.');
        return;
      }

      const areaId = this.resolveAreaIdForScope();
      const mappedStatus = normalizeStatus('todo') || 'todo';
      const mappedWeight = normalizeWeight(form.weight.value) || 'medium';
      if (!mappedWeight) {
        App.showToast('Peso inválido. Tente novamente.');
        return;
      }

      const payload = {
        project_id: projectId,
        area_id: filter.scope_type === 'area' ? areaId : areaId || null,
        scope_type: filter.scope_type,
        scope_id: filter.scope_id,
        title,
        task_type: form.task_type.value,
        status: mappedStatus,
        weight: mappedWeight,
        due_date: form.due_date.value || null,
        cost_expected: form.cost_expected.value ? Number(form.cost_expected.value) : 0,
        cost_real: 0,
        has_photo_before: false,
        has_photo_after: false
      };
      console.log('createTask payload', payload);
      const { data, error } = await DB.createTask(payload);
      if (error) {
        console.error(error);
        App.showToast('Não foi possível criar a tarefa.');
        return;
      }
      App.showToast('Tarefa criada.');
      form.reset();
      const normalized = {
        ...data,
        status: normalizeStatus(data.status) || 'todo',
        weight: normalizeWeight(data.weight) || 'medium'
      };
      this.state.projectTasks.unshift(normalized);
      this.applyScopeFilter();
      this.updateDashboard();
    });
  },

  resolveAreaIdForScope() {
    const { type, areaId, subAreaId, cornerId } = this.state.scopeSelection;
    if (type === 'area') return areaId;
    if (type === 'sub_area') {
      return this.findAreaIdBySubArea(subAreaId);
    }
    if (type === 'corner') {
      const cornerInfo = this.state.corners.find((c) => String(c.id) === String(cornerId));
      const parentSubAreaId = cornerInfo?.sub_area_id || subAreaId;
      const subArea = this.state.subAreas.find((sa) => String(sa.id) === String(parentSubAreaId));
      return subArea?.area_id || this.findAreaIdBySubArea(parentSubAreaId) || areaId;
    }
    return areaId;
  },

  openPhotoModal(taskId) {
    const modal = document.getElementById('photo-modal');
    if (!modal) return;
    this.state.photoModal.taskId = taskId;
    this.state.photoModal.beforePreview = null;
    this.state.photoModal.afterPreview = null;
    const beforeInput = document.getElementById('photoBefore');
    const afterInput = document.getElementById('photoAfter');
    if (beforeInput) beforeInput.value = '';
    if (afterInput) afterInput.value = '';
    const beforeImg = document.getElementById('photoBeforePreview');
    const afterImg = document.getElementById('photoAfterPreview');
    if (beforeImg) beforeImg.classList.add('hidden');
    if (afterImg) afterImg.classList.add('hidden');
    modal.classList.remove('hidden');
  },

  closePhotoModal() {
    const modal = document.getElementById('photo-modal');
    if (modal) modal.classList.add('hidden');
    this.state.photoModal.taskId = null;
    this.state.photoModal.beforePreview = null;
    this.state.photoModal.afterPreview = null;
  },

  async savePhotoFlags(trigger) {
    const taskId = this.state.photoModal.taskId;
    if (!taskId) return;
    if (trigger) trigger.disabled = true;
    const task = this.state.projectTasks.find((t) => String(t.id) === String(taskId));
    if (!task) {
      if (trigger) trigger.disabled = false;
      this.closePhotoModal();
      return;
    }

    const beforeFile = document.getElementById('photoBefore')?.files?.[0] || null;
    const afterFile = document.getElementById('photoAfter')?.files?.[0] || null;

    // V1: se o usuário escolheu arquivo, marcamos o booleano como true. Sem upload para storage.
    const hasBefore = Boolean(beforeFile) || Boolean(task.has_photo_before);
    const hasAfter = Boolean(afterFile) || Boolean(task.has_photo_after);

    const { data, error } = await DB.updateTaskPhotos(taskId, {
      has_photo_before: hasBefore,
      has_photo_after: hasAfter
    });
    if (error) {
      console.error(error);
      App.showToast('Não foi possível atualizar fotos.');
      if (trigger) trigger.disabled = false;
      return;
    }

    const normalized = {
      ...task,
      ...data,
      has_photo_before: hasBefore,
      has_photo_after: hasAfter,
      status: normalizeStatus(data.status || task.status) || 'todo',
      weight: normalizeWeight(data.weight || task.weight) || 'medium'
    };
    this.state.projectTasks = this.state.projectTasks.map((t) =>
      String(t.id) === String(taskId) ? normalized : t
    );
    this.applyScopeFilter();
    this.updateDashboard();
    this.closePhotoModal();
    App.showToast('Fotos salvas.');
    if (trigger) trigger.disabled = false;
  },

  bindScopeSelectors() {
    const typeSel = document.getElementById('scopeTypeSelect');
    const areaSel = document.getElementById('scopeAreaSelect');
    const subAreaSel = document.getElementById('scopeSubAreaSelect');
    const cornerSel = document.getElementById('scopeCornerSelect');
    if (!typeSel || !areaSel || !subAreaSel || !cornerSel) return;

    const syncAndLoad = async () => {
      this.syncScopeFromUI();
      this.applyScopeFilter();
      this.updateDashboard();
    };

    typeSel.addEventListener('change', syncAndLoad);
    areaSel.addEventListener('change', syncAndLoad);
    subAreaSel.addEventListener('change', syncAndLoad);
    cornerSel.addEventListener('change', syncAndLoad);
  },

  bindAddRoomCard() {
    const trigger = document.getElementById('add-room-card');
    const formCard = document.getElementById('area-form-card');
    if (!trigger || !formCard) return;
    const openForm = () => {
      trigger.setAttribute('aria-expanded', 'true');
      formCard.classList.remove('hidden');
      formCard.classList.add('is-revealed');
      formCard.setAttribute('aria-hidden', 'false');
      const input = formCard.querySelector('#areaName');
      if (input) input.focus();
    };
    trigger.addEventListener('click', openForm);
    trigger.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        openForm();
      }
    });
  },

  hideAreaForm() {
    const trigger = document.getElementById('add-room-card');
    const formCard = document.getElementById('area-form-card');
    const form = document.getElementById('areaForm');
    if (formCard) {
      formCard.classList.add('hidden');
      formCard.classList.remove('is-revealed');
      formCard.setAttribute('aria-hidden', 'true');
    }
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
    }
    if (form) {
      form.reset();
    }
  },

  syncScopeFromUI() {
    const typeSel = document.getElementById('scopeTypeSelect');
    const areaSel = document.getElementById('scopeAreaSelect');
    const subAreaSel = document.getElementById('scopeSubAreaSelect');
    const cornerSel = document.getElementById('scopeCornerSelect');
    const type = typeSel?.value || 'area';

    const nextScope = {
      type,
      areaId: areaSel?.value || this.state.areas[0]?.id || null,
      subAreaId: subAreaSel?.value || null,
      cornerId: cornerSel?.value || null
    };

    // Quando mudamos o tipo, limpamos descendentes inválidos para evitar seleções quebradas.
    if (nextScope.type === 'area') {
      nextScope.subAreaId = null;
      nextScope.cornerId = null;
    }
    if (nextScope.type === 'sub_area') {
      nextScope.cornerId = null;
      // se não escolher subárea, sugere a primeira disponível
      if (!nextScope.subAreaId) {
        const first = this.state.subAreas.find((sa) => String(sa.area_id) === String(nextScope.areaId));
        nextScope.subAreaId = first?.id || null;
      }
    }
    if (nextScope.type === 'corner') {
      if (!nextScope.subAreaId) {
        const first = this.state.subAreas.find((sa) => String(sa.area_id) === String(nextScope.areaId));
        nextScope.subAreaId = first?.id || null;
      }
      if (!nextScope.cornerId && nextScope.subAreaId) {
        const firstCorner = this.state.corners.find(
          (c) => String(c.sub_area_id) === String(nextScope.subAreaId)
        );
        nextScope.cornerId = firstCorner?.id || null;
      }
    }

    this.state.scopeSelection = nextScope;
    this.syncScopeUI();
  },

  syncScopeUI() {
    ProjectUI.populateScopeSelectors(
      this.state.areas,
      this.state.subAreas,
      this.state.corners,
      this.state.scopeSelection
    );
    ProjectUI.renderScopeSummary(this.state.scopeSelection, this.lookups());
  },

  resetScopeIfInvalid() {
    const { type, areaId, subAreaId, cornerId } = this.state.scopeSelection;
    if (type === 'area' && !this.state.areas.some((a) => String(a.id) === String(areaId))) {
      this.state.scopeSelection.areaId = this.state.areas[0]?.id || null;
    }
    if (type === 'sub_area' && !this.state.subAreas.some((sa) => String(sa.id) === String(subAreaId))) {
      this.state.scopeSelection.subAreaId = null;
      this.state.scopeSelection.type = 'area';
    }
    if (type === 'corner' && !this.state.corners.some((c) => String(c.id) === String(cornerId))) {
      this.state.scopeSelection.cornerId = null;
      this.state.scopeSelection.type = this.state.scopeSelection.subAreaId ? 'sub_area' : 'area';
    }
    this.syncScopeUI();
  },

  async handleMoveTask(id, direction) {
    const order = ['todo', 'doing', 'done'];
    const task = this.state.tasks.find((t) => String(t.id) === String(id));
    if (!task) return;
    const idx = order.indexOf(task.status);
    const nextIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= order.length) return;
    const nextStatus = order[nextIdx];

    const hasPhotosBefore = task.has_photo_before || task.photo_before_url;
    const hasPhotosAfter = task.has_photo_after || task.photo_after_url;
    if (nextStatus === 'done' && !(hasPhotosBefore && hasPhotosAfter)) {
      App.showToast('Adicione fotos antes/depois antes de concluir.');
      return;
    }

    const mappedStatus = normalizeStatus(nextStatus);
    console.log('mapped status', mappedStatus);
    if (!mappedStatus) {
      App.showToast('Status inválido. Tente novamente.');
      return;
    }

    const { data, error } = await DB.updateTaskStatus(task.id, mappedStatus);
    if (error) {
      console.error(error);
      App.showToast('Não foi possível mover a tarefa.');
      return;
    }
    const normalized = {
      ...data,
      status: normalizeStatus(data.status) || mappedStatus,
      weight: normalizeWeight(data.weight) || 'medium'
    };
    this.state.projectTasks = this.state.projectTasks.map((t) =>
      String(t.id) === String(id) ? normalized : t
    );
    this.applyScopeFilter();
    this.updateDashboard();

    // Pontuação ao concluir (apenas se fotos ok e não pontuado anteriormente).
    if (mappedStatus === 'done') {
      const { session } = await DB.getSession();
      const userId = session?.user?.id;
      if (userId) {
        const ledger = loadPointsLedger(userId, this.state.project.id);
        const alreadyScored = ledger[id];
        const hasPhotos = normalized.has_photo_before && normalized.has_photo_after;
        if (!alreadyScored && hasPhotos) {
          const delta = 80 * getWeightValue(normalized.weight);
          const { error: pointsError } = await DB.updateUserLifetimePoints(delta);
          if (!pointsError) {
            ledger[id] = true;
            savePointsLedger(userId, this.state.project.id, ledger);
            console.info('Pontuação aplicada', { taskId: id, delta });
          } else {
            console.warn('Falha ao atualizar pontos', pointsError);
          }
        }
      }
    }
  }
};

// Delegação específica da página de projeto (áreas, subáreas, cantos e tarefas)
document.addEventListener('click', async (event) => {
  const coverTrigger = event.target.closest('[data-action="pick-entity-cover"]');
  if (coverTrigger) {
    event.preventDefault();
    const type = coverTrigger.dataset.entityType;
    const id = coverTrigger.dataset.entityId;
    ProjectPage.openCoverFileSelector(type, id);
    return;
  }

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
    return;
  }

  const togglePanelBtn = event.target.closest('[data-action="toggle-area-manage"]');
  if (togglePanelBtn) {
    const areaId = togglePanelBtn.dataset.areaId;
    const panel = document.querySelector(`[data-area-panel="${areaId}"]`);
    panel?.classList.toggle('hidden');
    return;
  }

  const editSubAreaBtn = event.target.closest('[data-action="edit-sub-area"]');
  if (editSubAreaBtn) {
    event.preventDefault();
    await ProjectPage.handleEditSubArea(editSubAreaBtn.dataset.subAreaId);
    return;
  }

  const deleteSubAreaBtn = event.target.closest('[data-action="delete-sub-area"]');
  if (deleteSubAreaBtn) {
    event.preventDefault();
    await ProjectPage.handleDeleteSubArea(deleteSubAreaBtn.dataset.subAreaId);
    return;
  }

  const toggleCornersBtn = event.target.closest('[data-action="toggle-corners"]');
  if (toggleCornersBtn) {
    const panel = document.querySelector(`[data-corner-panel="${toggleCornersBtn.dataset.subAreaId}"]`);
    panel?.classList.toggle('hidden');
    return;
  }

  const editCornerBtn = event.target.closest('[data-action="edit-corner"]');
  if (editCornerBtn) {
    event.preventDefault();
    await ProjectPage.handleEditCorner(editCornerBtn.dataset.cornerId);
    return;
  }

  const deleteCornerBtn = event.target.closest('[data-action="delete-corner"]');
  if (deleteCornerBtn) {
    event.preventDefault();
    await ProjectPage.handleDeleteCorner(deleteCornerBtn.dataset.cornerId);
    return;
  }

  const moveBtn = event.target.closest('[data-action="move-task"]');
  if (moveBtn) {
    event.preventDefault();
    const id = moveBtn.dataset.taskId;
    const dir = moveBtn.dataset.direction;
    await ProjectPage.handleMoveTask(id, dir);
  }

  const photosBtn = event.target.closest('[data-action="open-photos"]');
  if (photosBtn) {
    event.preventDefault();
    ProjectPage.openPhotoModal(photosBtn.dataset.taskId);
    return;
  }

  const savePhotosBtn = event.target.closest('[data-action="save-photos"]');
  if (savePhotosBtn) {
    event.preventDefault();
    await ProjectPage.savePhotoFlags(savePhotosBtn);
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target;
  const action = form?.dataset?.action;
  if (!action) return;
  if (action === 'create-sub-area') {
    event.preventDefault();
    await ProjectPage.handleCreateSubArea(form);
  }
  if (action === 'create-corner') {
    event.preventDefault();
    await ProjectPage.handleCreateCorner(form);
  }

});

// Exposição global para compatibilidade com chamadas inline.
(() => {
  const initProjectPage = (...args) => ProjectPage.init(...args);
  window.ProjectPage = window.ProjectPage || ProjectPage;
  if (!window.ProjectPage.init) {
    window.ProjectPage.init = initProjectPage;
  }
  if (!window.initProjectPage) {
    window.initProjectPage = initProjectPage;
  }
})();
