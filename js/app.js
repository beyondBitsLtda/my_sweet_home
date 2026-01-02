// Arquivo central de utilidades front-end.
// Mantemos tudo extremamente comentado para servir de guia didático para quem está começando em JS puro.

const App = {
  // Estado global mínimo: usuário autenticado e aba ativa.
  state: {
    user: null,
    currentTab: 'structure',
    toastTimer: null,
    isSendingOtp: false, // evita múltiplos envios e respeita o rate limit do Supabase (>=3s)
    projects: [],
    signupEmailTimer: null,
    signupEmailExists: false,
    signupEmailCheckToken: null,
    selectedHomeType: null
  },

  // Navegação básica entre páginas HTML estáticas.
  // Preferimos window.location para alinhar com o escopo de um site estático (GitHub Pages).
  navigate(target) {
    window.location.href = target;
  },

  /**
   * requireAuth
   * - Em páginas protegidas (app.html, project.html, planner.html), redireciona quem não estiver autenticado.
   */
  async requireAuth() {
    const { session } = await DB.getSession();
    if (!session) {
      App.navigate('index.html');
      return;
    }
    App.state.user = session.user;
    App.updateHeader(session.user);
  },

  /**
   * renderAuthUI
   * - Controla o que aparece na tela de autenticação:
   *   - Se houver sessão: esconde o formulário e mostra o card “logado como”.
   *   - Se não houver sessão: mostra o formulário e oculta o card logado.
   * - Evita enviar Magic Link “por cima” de uma sessão ativa.
   */
  renderAuthUI(session) {
    const loginCard = document.getElementById('login-card');
    const loggedCard = document.getElementById('logged-card');
    const loggedEmail = document.getElementById('logged-email');

    // Se estiver fora da página de auth, nada a fazer.
    if (!loginCard || !loggedCard) return;

    if (session?.user) {
      loginCard.classList.add('hidden');
      loggedCard.classList.remove('hidden');
      if (loggedEmail) loggedEmail.textContent = session.user.email;
    } else {
      loginCard.classList.remove('hidden');
      loggedCard.classList.add('hidden');
    }
  },

  /**
   * setHomeTypeSelection
   * - Ajusta visualmente os cards de moradia e sincroniza o select do formulário.
   */
  setHomeTypeSelection(homeType) {
    App.state.selectedHomeType = homeType;
    const homeTypeSelect = document.getElementById('homeType');
    const createCard = document.getElementById('createProjectCard');
    const cards = document.querySelectorAll('.home-card');

    cards.forEach((card) => {
      const isSelected = card.dataset.homeType === homeType;
      card.classList.toggle('selected', isSelected);
      const label = card.querySelector('[data-selected-label]');
      if (label) label.classList.toggle('hidden', !isSelected);
      if (card.dataset.state === 'disabled' || card.classList.contains('is-disabled')) {
        card.setAttribute('aria-pressed', 'false');
      } else {
        card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      }
    });

    if (homeTypeSelect && homeType) {
      homeTypeSelect.value = homeType;
    }
    if (createCard) {
      createCard.classList.toggle('hidden', !homeType);
    }
  },

  /**
   * switchTab
   * - Troca o painel visível respeitando o design minimalista de tabs com linha inferior.
   */
  switchTab(event) {
    const tabName = event?.target?.dataset?.tab;
    if (!tabName) return;
    App.state.currentTab = tabName;

    document.querySelectorAll('.tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-panel').forEach((panel) => {
      const shouldShow = panel.id === `tab-${tabName}`;
      panel.classList.toggle('hidden', !shouldShow);
    });
  },

  // Helpers de visibilidade para modais.
  showModal() {
    const modal = document.getElementById('modal');
    if (modal) modal.classList.remove('hidden');
  },
  hideModal() {
    const modal = document.getElementById('modal');
    if (modal) modal.classList.add('hidden');
  },

  // Toast simples: injeta texto e usa timeout para esconder.
  showToast(message = 'Ação executada com sucesso', duration = 2400) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.remove('hidden');

    clearTimeout(App.state.toastTimer);
    App.state.toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, duration);
  },

  /**
   * resetSignupBlockers
   * - Limpa mensagens e reabilita o botão de submit ao sair do modo signup ou apagar email.
   */
  resetSignupBlockers() {
    const helper = document.getElementById('signup-email-status');
    const submit = document.getElementById('auth-submit');
    App.state.signupEmailExists = false;
    App.state.signupEmailCheckToken = null;
    if (App.state.signupEmailTimer) {
      clearTimeout(App.state.signupEmailTimer);
      App.state.signupEmailTimer = null;
    }
    if (submit) submit.disabled = false;
    if (helper) {
      helper.textContent = '';
      helper.classList.add('hidden');
      helper.classList.remove('danger', 'inline-hint');
    }
  },

  /**
   * updateHeader
   * - Ajusta o header para o estado logado/deslogado sem quebrar o layout editorial.
   */
  updateHeader(user) {
    const container = document.getElementById('session-actions');
    if (!container) return;

    // Limpa o conteúdo atual para reescrever.
    container.innerHTML = '';

    if (!user) {
      container.innerHTML = `
        <button class="btn ghost" type="button" onclick="App.navigate('index.html')">Entrar</button>
        <button class="btn primary" type="button" onclick="App.navigate('index.html')">Criar conta</button>
      `;
      return;
    }

    // Saudações discretas e alinhadas ao estilo editorial.
    const greeting = document.createElement('span');
    greeting.className = 'muted';
    greeting.textContent = `Olá, ${user.email}`;

    const logoutButton = document.createElement('button');
    logoutButton.className = 'btn ghost';
    logoutButton.type = 'button';
    logoutButton.dataset.action = 'logout'; // usado na delegação para garantir que sempre funcione
    logoutButton.textContent = 'Sair';

    container.append(greeting, logoutButton);
  },

  rememberProjectId(projectId) {
    if (!projectId) return;
    try {
      localStorage.setItem('msh_last_project_id', projectId);
    } catch (e) {
      console.warn('Não foi possível salvar o último projeto', e);
    }
  },

  readRememberedProjectId() {
    try {
      return localStorage.getItem('msh_last_project_id');
    } catch (e) {
      console.warn('Não foi possível ler o último projeto', e);
      return null;
    }
  },

  clearRememberedProjectId() {
    try {
      localStorage.removeItem('msh_last_project_id');
    } catch (e) {
      console.warn('Não foi possível limpar o último projeto', e);
    }
  },

  /**
   * syncNavLinksWithProject
   * - Garante que os links Projeto/Planta preservem o parâmetro id do projeto atual.
   */
  syncNavLinksWithProject(projectId) {
    if (!projectId) return;
    document.querySelectorAll('.nav .nav-link').forEach((link) => {
      const href = link.getAttribute('href') || '';
      if (!href.includes('project.html') && !href.includes('planner.html')) return;
      const [path] = href.split('?');
      link.setAttribute('href', `${path}?id=${encodeURIComponent(projectId)}`);
    });
  },

  /**
   * focusLogin
   * - Faz scroll suave até o card de login para manter o fluxo convidativo.
   */
  focusLogin() {
    const loginCard = document.getElementById('login-card');
    if (loginCard) loginCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  /**
   * switchAccount
   * - Permite trocar de conta de forma explícita: faz logout antes de exibir o formulário novamente.
   * - Evita enviar Magic Link por cima de uma sessão ativa.
   */
  async switchAccount() {
    await App.performLogout({ redirect: false, message: 'Sessão encerrada. Insira o novo email para entrar.' });
  },

  /**
   * handleLogout
   * - Logout básico reutilizável (botões “Sair”).
   */
  async handleLogout(event) {
    event?.preventDefault();
    await App.performLogout();
  },

  /**
   * performLogout
   * - Centraliza a saída para evitar duplicação. Usa delegação para funcionar mesmo após re-render de header.
   */
  async performLogout({ redirect = true, message = 'Você saiu da sua conta.' } = {}) {
    const { error } = await DB.authSignOut();
    if (error) {
      App.showToast('Não foi possível sair. Tente novamente.');
      console.error(error);
      return;
    }
    App.state.user = null;
    App.updateHeader(null);
    App.renderAuthUI?.(null);
    App.clearRememberedProjectId();
    App.showToast(message);
    if (redirect) App.navigate('index.html');
  },

  /**
   * switchAuthTab
   * - Alterna o texto e os campos entre Entrar, Criar conta e Esqueci minha senha.
   * - O fluxo técnico muda conforme o modo (login, signup, reset).
   */
  switchAuthTab(event) {
    const mode = event?.target?.dataset?.mode;
    if (!mode) return;
    document.querySelectorAll('.auth-tabs .tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    const helper = document.getElementById('auth-helper');
    const submit = document.getElementById('auth-submit');
    const passwordGroup = document.getElementById('password-group');
    const confirmGroup = document.getElementById('confirm-group');
    const signupNote = document.getElementById('signup-note');
    const emailInput = document.getElementById('loginEmail');

    if (mode !== 'signup') {
      App.resetSignupBlockers();
    }

    if (mode === 'signup') {
      helper.textContent = 'Use email e senha fortes. Se o email já existir, mostraremos a mensagem para fazer login.';
      submit.textContent = 'Criar conta';
      passwordGroup.classList.remove('hidden');
      confirmGroup.classList.remove('hidden');
      signupNote?.classList.remove('hidden');
      submit.classList.remove('secondary');
      submit.classList.add('primary');
    } else if (mode === 'reset') {
      helper.textContent = 'Enviaremos um link de redefinição para o seu email.';
      submit.textContent = 'Enviar link de redefinição';
      passwordGroup.classList.add('hidden');
      confirmGroup.classList.add('hidden');
      signupNote?.classList.add('hidden');
      submit.classList.remove('primary');
      submit.classList.add('secondary');
    } else {
      helper.textContent = 'Digite seu email e senha para entrar.';
      submit.textContent = 'Entrar';
      passwordGroup.classList.remove('hidden');
      confirmGroup.classList.add('hidden');
      signupNote?.classList.add('hidden');
      submit.classList.remove('secondary');
      submit.classList.add('primary');
    }

    submit.dataset.mode = mode;
    if (mode === 'signup' && emailInput) {
      App.handleSignupEmailInput({ target: emailInput });
    }
  },

  /**
   * handleSignupEmailInput
   * - Faz debounce de verificação de email existente apenas quando a aba for “Criar conta”.
   */
  handleSignupEmailInput(event) {
    const mode = document.querySelector('.auth-tabs .tab.active')?.dataset?.mode || 'login';
    if (mode !== 'signup') {
      App.resetSignupBlockers();
      return;
    }

    const email = (event?.target?.value || '').trim();
    const status = document.getElementById('signup-email-status');
    const submit = document.getElementById('auth-submit');

    if (status) {
      status.classList.add('hidden');
      status.classList.remove('danger', 'inline-hint');
      status.textContent = '';
    }
    if (submit) submit.disabled = false;
    if (App.state.signupEmailTimer) clearTimeout(App.state.signupEmailTimer);

    if (!email) {
      App.state.signupEmailExists = false;
      return;
    }

    App.state.signupEmailTimer = setTimeout(() => App.checkSignupEmailAvailability(email), 600);
  },

  /**
   * checkSignupEmailAvailability
   * - Chama Supabase com debounce para descobrir se o email já tem conta.
   */
  async checkSignupEmailAvailability(email) {
    const helper = document.getElementById('signup-email-status');
    const submit = document.getElementById('auth-submit');
    if (!submit || typeof window.supabase !== 'object') return;

    const checkToken = Date.now();
    App.state.signupEmailCheckToken = checkToken;

    if (helper) {
      helper.classList.remove('hidden');
      helper.classList.remove('danger');
      helper.textContent = 'Verificando disponibilidade...';
    }

    const { exists, error } = await DB.checkEmailExists(email);

    // Ignora respostas antigas se um novo check foi disparado.
    if (App.state.signupEmailCheckToken !== checkToken) return;

    if (error) {
      console.warn('Não foi possível verificar email no Supabase.', error);
      if (helper) helper.classList.add('hidden');
      submit.disabled = false;
      App.state.signupEmailExists = false;
      return;
    }

    if (exists) {
      if (helper) {
        helper.textContent = 'Esse email já possui conta. Vá para Entrar.';
        helper.classList.remove('hidden');
        helper.classList.add('danger', 'inline-hint');
      }
      submit.disabled = true;
      App.state.signupEmailExists = true;
      return;
    }

    if (helper) {
      helper.textContent = '';
      helper.classList.add('hidden');
      helper.classList.remove('danger');
    }
    submit.disabled = false;
    App.state.signupEmailExists = false;
  },

  /**
   * handleLogin
   * - Captura o submit do formulário e dispara o fluxo adequado (login, signup ou reset).
   */
  async handleLogin(event) {
    event.preventDefault();
    // Verificação defensiva: se a lib Supabase não estiver disponível, aborta e avisa.
    if (typeof window.supabase !== 'object') {
      App.showToast('Não foi possível carregar o Supabase. Recarregue a página.');
      return;
    }

    const current = await DB.getSession();
    if (current.session?.user) {
      App.showToast('Você já está autenticado. Redirecionando para o app.');
      App.navigate('app.html');
      return;
    }

    const mode = document.getElementById('auth-submit')?.dataset?.mode || 'login';
    const email = (document.getElementById('loginEmail')?.value || '').trim();
    if (!email) {
      App.showToast('Informe um e-mail válido.');
      return;
    }
    if (mode === 'signup' && App.state.signupEmailExists) {
      App.showToast('Esse email já possui conta. Vá para Entrar.');
      return;
    }

    const submitButton = event.target.querySelector('button[type="submit"]');
    App.state.isSendingOtp = true;
    if (submitButton) submitButton.disabled = true;

    try {
      if (mode === 'reset') {
        const { error } = await DB.authResetPassword(email);
        if (error) {
          App.showToast('Não foi possível enviar o link de redefinição. Tente novamente.');
          console.error(error);
          return;
        }
        App.showToast('Enviamos um link de redefinição para seu email.');
        document.querySelector('.tab[data-mode="login"]')?.click();
        event.target.reset();
        return;
      }

      const password = (document.getElementById('loginPassword')?.value || '').trim();
      if (!password) {
        App.showToast('Senha é obrigatória.');
        return;
      }

      if (mode === 'signup') {
        const confirm = (document.getElementById('confirm')?.value || '').trim();
        if (password.length < 8) {
          App.showToast('Senha fraca. Use pelo menos 8 caracteres.');
          return;
        }
        if (password !== confirm) {
          App.showToast('As senhas não conferem.');
          return;
        }

        const { data, error } = await DB.authSignUp(email, password);
        if (error) {
          if (error.message?.toLowerCase().includes('already registered')) {
            App.showToast('Esse email já está cadastrado. Faça login.');
          } else {
            App.showToast('Não foi possível criar a conta. Tente novamente.');
          }
          console.error(error);
          return;
        }

        // Se a política exigir confirmação de email, session vem nula. Orientamos o usuário.
        if (!data.session) {
          App.showToast('Conta criada! Confirme seu email para ativar o acesso. Abra sua caixa de entrada e clique no link de confirmação.');
          document.querySelector('.tab[data-mode="login"]')?.click();
          event.target.reset();
          return;
        }

        await DB.upsertProfile(data.user);
        App.showToast('Conta criada com sucesso. Redirecionando...');
        App.navigate('app.html');
        return;
      }

      // Login
      const { data, error } = await DB.authSignInWithPassword(email, password);
      if (error) {
        const msg = error.message?.toLowerCase() || '';
        if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) {
          App.showToast('Confirme seu email antes de entrar.');
        } else {
          App.showToast('Email ou senha inválidos.');
        }
        console.error(error);
        return;
      }
      await DB.upsertProfile(data.user);
      App.showToast('Login concluído. Redirecionando...');
      App.navigate('app.html');
    } finally {
      // Cooldown mínimo para evitar spam de requisições.
      setTimeout(() => {
        App.state.isSendingOtp = false;
        if (submitButton) submitButton.disabled = false;
      }, 1200);
    }
  },

  /**
   * ensureProfile
   * - Após autenticar, garante que exista uma linha em users_profile.
   * - Importante porque o restante do app (pontuação etc.) depende dessa estrutura.
   */
  async ensureProfile(user) {
    const { error } = await DB.upsertProfile(user);
    if (error) {
      console.warn('Não foi possível criar/atualizar o perfil:', error.message);
    }
  },

  /**
   * Carrega e renderiza os projetos do usuário logado (usado no app.html).
   */
  async loadProjects(user) {
    const appUI = document.querySelector('#appUI') || document.querySelector('[data-app-ui]');
    const grid = document.getElementById('projects-grid');
    if (!appUI || !grid) {
      console.error('appUI container not found');
      return;
    }
    if (!user) {
      grid.innerHTML = '<p class="muted">Você precisa estar autenticado.</p>';
      return;
    }

    grid.innerHTML = '<p class="muted">Carregando projetos...</p>';

    const { data, error } = await DB.listProjects(user.id);
    if (error) {
      console.error(error);
      grid.innerHTML = '<p class="muted">Não foi possível carregar projetos.</p>';
      return;
    }
    const enriched = await Promise.all(
      (data || []).map(async (proj) => {
        const resolvedCover = await DB.getProjectCoverUrl(proj);
        return { ...proj, resolved_cover_url: resolvedCover };
      })
    );
    App.state.projects = enriched;
    App.renderProjects(App.state.projects, grid);
  },

  renderProjects(projects, container) {
    if (!container) return;
    if (!projects.length) {
      container.innerHTML = '<p class="muted">Nenhum projeto ainda. Crie o primeiro apartamento.</p>';
      return;
    }
    const cards = projects
      .map((proj) => {
        const progress = 72;
        const period = proj.start_date && proj.end_date ? `${proj.start_date} · ${proj.end_date}` : 'Sem datas';
        const budget = proj.budget_expected ? `Budget R$ ${proj.budget_expected}` : 'Budget não definido';
        const coverSrc = proj.cover_url || proj.resolved_cover_url || 'assets/img/project_placeholder.webp';
        const isPlaceholder = !proj.cover_url && !proj.resolved_cover_url;
        const cover = `
          <div class="cover-frame is-card ${isPlaceholder ? 'is-placeholder' : ''}">
            <img class="cover-img" src="${coverSrc}" alt="Capa do projeto ${proj.name}" data-cover-path="${proj.cover_path || ''}" onerror="App.handleCoverError(event)" />
            <div class="cover-overlay">
              <span class="cover-overlay__text">Imagem placeholder</span>
            </div>
          </div>`;
        return `
        <article class="card project-card">
          ${cover}
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
    container.innerHTML = cards;
  },

  handleCoverError(event) {
    const img = event?.target;
    if (!img) return;
    const shell = img.closest('.cover-frame');
    const coverPath = img.dataset.coverPath;

    // Se já tentamos fallback, mostra placeholder.
    if (img.dataset.signedTried === 'true' || !coverPath) {
      console.warn('Capa do projeto não carregou', img.src);
      img.onerror = null;
      img.src = 'assets/img/project_placeholder.webp';
      if (shell) shell.classList.add('is-placeholder');
      return;
    }

    // Tenta gerar signed URL como fallback final.
    img.dataset.signedTried = 'true';
    DB.getSignedProjectCoverUrl(coverPath).then((signedUrl) => {
      if (signedUrl) {
        console.info('Usando signed URL para capa do projeto', signedUrl);
        img.src = signedUrl;
        if (placeholder) placeholder.classList.add('hidden');
        img.classList.remove('hidden');
      } else {
        console.warn('Não foi possível carregar a capa, exibindo placeholder', img.src);
        img.onerror = null;
        img.classList.add('hidden');
        if (placeholder) placeholder.classList.remove('hidden');
      }
    });
  },

  /**
   * Exclui um projeto com confirmação e re-render da lista.
   */
  async handleDeleteProject(projectId, trigger) {
    if (!projectId) return;
    const grid = document.getElementById('projects-grid');
    const confirmed = window.confirm('Excluir projeto?\n\nEssa ação não pode ser desfeita. O projeto será removido permanentemente.');
    if (!confirmed) return;

    if (trigger) trigger.disabled = true;
    const { error } = await DB.deleteProject(projectId);
    if (error) {
      console.error(error);
      App.showToast('Não foi possível excluir. Tente novamente.');
      if (trigger) trigger.disabled = false;
      return;
    }

    App.showToast('Projeto excluído.');
    App.state.projects = App.state.projects.filter((p) => String(p.id) !== String(projectId));
    ProjectUI.renderProjects(App.state.projects, grid);
  }
};

// Inicialização simples: registra listeners e conecta Supabase.
document.addEventListener('DOMContentLoaded', async () => {
  // Garante que a lib do Supabase está carregada; se não estiver, avisamos, mas seguimos com binds para não quebrar o restante da página.
  if (typeof window.supabase !== 'object') {
    App.showToast('Não foi possível carregar o Supabase. Recarregue a página.');
  }

  // Reaplica a aba salva no estado (apenas efeito visual).
  const savedTab = App.state.currentTab;
  const defaultTabButton = document.querySelector(`.tab[data-tab="${savedTab}"]`);
  defaultTabButton?.click();

  // Trata erros de retorno de magic link (ex.: otp_expired) logo no carregamento da index.
  // O Supabase devolve o status no hash (#error=...), por isso fazemos o parse manual.
  if (location.hash.includes('error_code=otp_expired') || location.hash.includes('error=access_denied')) {
    App.showToast('Link expirou. Solicite um novo login.');
    // Limpamos o hash para não reaparecer em navegações futuras.
    history.replaceState(null, '', location.pathname + location.search);
  }

  // Hook do formulário de login (index).
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (event) => App.handleLogin(event));
  }
  const loginEmail = document.getElementById('loginEmail');
  if (loginEmail) {
    loginEmail.addEventListener('input', (event) => App.handleSignupEmailInput(event));
  }
  const submitBtn = document.getElementById('auth-submit');
  if (submitBtn && !submitBtn.dataset.mode) submitBtn.dataset.mode = 'login';

  const isAuthPage = location.pathname.endsWith('index.html') || location.pathname.endsWith('/');
  const isAppPage = location.pathname.endsWith('app.html');
  const projectIdParam = new URLSearchParams(location.search).get('id');
  if (projectIdParam) {
    App.rememberProjectId(projectIdParam);
    App.syncNavLinksWithProject(projectIdParam);
  } else {
    const lastProjectId = App.readRememberedProjectId();
    App.syncNavLinksWithProject(lastProjectId);
  }

  // Recupera sessão ativa e atualiza header e UI de auth.
  const { session } = await DB.getSession();
  App.state.user = session?.user ?? null;
  App.updateHeader(App.state.user);
  if (isAuthPage) {
    App.renderAuthUI(session);
    if (session?.user) App.navigate('app.html');
  }

  if (isAppPage) {
    await App.requireAuth();
    await App.loadProjects(App.state.user);

    const homeTypeGrid = document.getElementById('homeTypeGrid');
    const homeTypeSelect = document.getElementById('homeType');
    const createCard = document.getElementById('createProjectCard');

    if (createCard) createCard.classList.add('hidden');
    App.setHomeTypeSelection(null);

    if (homeTypeGrid) {
      homeTypeGrid.addEventListener('click', (event) => {
        const card = event.target.closest('.home-card');
        if (!card) return;
        const type = card.dataset.homeType;
        const isDisabled = card.classList.contains('is-disabled') || card.dataset.state === 'disabled';
        if (isDisabled) {
          App.showToast('Disponível em breve');
          return;
        }
        App.setHomeTypeSelection(type);
      });
    }

    const createForm = document.getElementById('createProjectForm');
    const coverInput = document.getElementById('projectCoverInput');
    const coverPreview = document.getElementById('projectCoverPreview');
    const coverPreviewImg = document.getElementById('projectCoverPreviewImage');
    const coverPreviewHint = document.getElementById('projectCoverPreviewHint');

    const resetCoverPreview = () => {
      if (coverPreviewImg) {
        coverPreviewImg.src = '';
        coverPreviewImg.classList.add('hidden');
      }
      if (coverPreviewHint) {
        coverPreviewHint.textContent = 'Pré-visualização aparecerá aqui.';
        coverPreviewHint.classList.remove('hidden');
      }
      if (coverPreview) coverPreview.classList.remove('has-image');
    };

    const showCoverPreview = (file) => {
      if (!coverPreviewImg || !coverPreviewHint) return;
      if (!file) {
        resetCoverPreview();
        return;
      }
      const url = URL.createObjectURL(file);
      coverPreviewImg.src = url;
      coverPreviewImg.classList.remove('hidden');
      coverPreviewHint.textContent = 'A imagem será enviada após criar o projeto.';
      coverPreviewHint.classList.remove('hidden');
      if (coverPreview) coverPreview.classList.add('has-image');
    };

    if (coverInput) {
      coverInput.addEventListener('change', (ev) => {
        const file = ev.target.files?.[0];
        showCoverPreview(file);
      });
    }

    if (createForm) {
      createForm.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        if (!App.state.user) {
          App.showToast('Faça login para criar projetos.');
          return;
        }
        if (!App.state.selectedHomeType) {
          App.showToast('Selecione o tipo de moradia para continuar.');
          return;
        }
        const homeType = App.state.selectedHomeType;
        if (homeTypeSelect) homeTypeSelect.value = homeType;
        if (homeType !== 'apartment') {
          App.showToast('Disponível em breve. Use Apartamento na V1.');
          return;
        }
        const payload = {
          name: createForm.name.value.trim(),
          home_type: homeType,
          mode: createForm.mode.value,
          start_date: createForm.start_date.value || null,
          end_date: createForm.end_date.value || null,
          budget_expected: createForm.budget_expected.value ? Number(createForm.budget_expected.value) : null,
          budget_real: createForm.budget_real.value ? Number(createForm.budget_real.value) : null
        };
        const coverInputEl = document.getElementById('projectCoverInput');
        const coverFile = coverInputEl?.files?.[0] || null;
        console.log('[cover] input exists?', !!coverInputEl);
        console.log('[cover] file', coverFile ? { name: coverFile.name, type: coverFile.type, size: coverFile.size } : null);
        const { data, error } = await DB.createProject(payload);
        if (error) {
          console.error(error);
          App.showToast('Não foi possível criar o projeto.');
          return;
        }
        App.showToast('Projeto criado.');
        let coverUrl = null;
        if (coverFile) {
          const { data: uploadData, error: uploadError } = await DB.uploadProjectCover(App.state.user.id, data.id, coverFile);
          if (uploadError) {
            console.warn('Falha ao enviar capa do projeto', uploadError);
            App.showToast('Não foi possível enviar a capa. O projeto foi criado sem foto.');
          } else if (uploadData?.cover_url || uploadData?.cover_path) {
            const { data: updated, error: updateError } = await DB.updateProjectCover(
              data.id,
              App.state.user.id,
              uploadData.cover_url,
              uploadData.cover_path
            );
            if (updateError) {
              console.warn('Falha ao salvar capa do projeto', updateError);
              App.showToast('Projeto criado, mas não foi possível salvar a capa.');
            } else {
              coverUrl = updated?.cover_url || uploadData.cover_url || null;
            }
          }
        }
        createForm.reset();
        resetCoverPreview();
        await App.loadProjects(App.state.user);
      });
    }
  }

  // Se estivermos em páginas protegidas, força autenticação.
  const protectedPage = location.pathname.endsWith('app.html') || location.pathname.endsWith('project.html') || location.pathname.endsWith('planner.html');
  if (protectedPage) {
    await App.requireAuth();
  }

  // Garante a criação/atualização do perfil ao receber uma nova sessão (ex.: magic link).
  DB.onAuthStateChange(async (event, newSession) => {
    const isAuthPage = location.pathname.endsWith('index.html') || location.pathname.endsWith('/');
    const nextUser = newSession?.user ?? null;

    // Tratamos apenas eventos relevantes para evitar poluir a navegação com toasts constantes
    // em refresh de token ou atualizações silenciosas.
    if (event === 'SIGNED_OUT') {
      App.state.user = null;
      App.updateHeader(null);
      if (isAuthPage) App.renderAuthUI(null);
      return;
    }

    if (event === 'SIGNED_IN') {
      App.state.user = nextUser;
      App.updateHeader(App.state.user);
      if (isAuthPage) App.renderAuthUI(newSession);
      if (nextUser) {
        await App.ensureProfile(nextUser);
        App.showToast('Login concluído com sucesso.');
      }
      return;
    }

    // Mantém o estado em sincronia sem mensagens extras em eventos como TOKEN_REFRESHED.
    App.state.user = nextUser;
    App.updateHeader(App.state.user);
    if (isAuthPage) App.renderAuthUI(newSession);
  });

  // Delegação de eventos para logout: funciona mesmo se o header for re-renderizado.
  document.addEventListener('click', async (event) => {
    const logoutBtn = event.target.closest('[data-action="logout"]');
    if (logoutBtn) {
      event.preventDefault();
      await App.performLogout();
      return;
    }

    // Delegação para excluir projetos na lista (apenas no app).
    const deleteBtn = event.target.closest('[data-action="delete-project"]');
    if (deleteBtn) {
      event.preventDefault();
      const projectId = deleteBtn.dataset.projectId;
      await App.handleDeleteProject(projectId, deleteBtn);
    }
  });
});
