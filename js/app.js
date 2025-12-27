// Arquivo central de utilidades front-end.
// Mantemos tudo extremamente comentado para servir de guia didático para quem está começando em JS puro.

const App = {
  // Estado global mínimo: usuário autenticado e aba ativa.
  state: {
    user: null,
    currentTab: 'structure',
    toastTimer: null,
    isSendingOtp: false // evita múltiplos envios e respeita o rate limit do Supabase (>=3s)
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
  const submitBtn = document.getElementById('auth-submit');
  if (submitBtn && !submitBtn.dataset.mode) submitBtn.dataset.mode = 'login';

  const isAuthPage = location.pathname.endsWith('index.html') || location.pathname.endsWith('/');

  // Recupera sessão ativa e atualiza header e UI de auth.
  const { session } = await DB.getSession();
  App.state.user = session?.user ?? null;
  App.updateHeader(App.state.user);
  if (isAuthPage) {
    App.renderAuthUI(session);
  }

  // Se estivermos em páginas protegidas, força autenticação.
  const protectedPage = location.pathname.endsWith('app.html') || location.pathname.endsWith('project.html') || location.pathname.endsWith('planner.html');
  if (protectedPage) {
    await App.requireAuth();
  }

  // Garante a criação/atualização do perfil ao receber uma nova sessão (ex.: magic link).
  DB.onAuthStateChange(async (_event, newSession) => {
    App.state.user = newSession?.user ?? null;
    App.updateHeader(App.state.user);

    const isAuthPage = location.pathname.endsWith('index.html') || location.pathname.endsWith('/');
    App.renderAuthUI(newSession);

    if (newSession?.user) {
      await App.ensureProfile(newSession.user);
      App.showToast('Login concluído com sucesso.');
      // Em páginas protegidas, manter navegação; na página de auth mostramos card logado.
    }
  });

  // Delegação de eventos para logout: funciona mesmo se o header for re-renderizado.
  document.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-action="logout"]');
    if (!target) return;
    event.preventDefault();
    await App.performLogout();
  });
});
