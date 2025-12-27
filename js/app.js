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
    logoutButton.textContent = 'Sair';
    // Handler explícito com preventDefault e await para garantir que o logout finalize
    // antes de redirecionar. Isso evita estados inconsistentes em múltiplas abas.
    logoutButton.onclick = async (event) => {
      event.preventDefault();
      await DB.authSignOut();
      App.state.user = null;
      App.updateHeader(null);
      App.showToast('Você saiu com segurança.');
      App.navigate('index.html');
    };

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
    await DB.authSignOut();
    App.state.user = null;
    App.renderAuthUI(null);
    App.updateHeader(null);
    App.showToast('Sessão encerrada. Insira o novo email para entrar.');
  },

  /**
   * handleLogout
   * - Logout básico reutilizável (botões “Sair”).
   */
  async handleLogout(event) {
    event?.preventDefault();
    await DB.authSignOut();
    App.state.user = null;
    App.updateHeader(null);
    App.renderAuthUI(null);
    App.showToast('Você saiu com segurança.');
    App.navigate('index.html');
  },

  /**
   * switchAuthTab
   * - Alterna o texto de apoio do formulário entre “Entrar” e “Criar conta”.
   * - O fluxo técnico é o mesmo (magic link), mas a cópia comunica a intenção do usuário.
   */
  switchAuthTab(event) {
    const mode = event?.target?.dataset?.mode;
    if (!mode) return;
    document.querySelectorAll('.auth-tabs .tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });
    const helper = document.getElementById('auth-helper');
    const submit = document.querySelector('#login-form button[type="submit"]');
    if (mode === 'signup') {
      helper.textContent = 'Se esse email já estiver cadastrado, você receberá um link para entrar. Se não estiver, o link cria sua conta automaticamente.';
      submit.textContent = 'Criar conta';
    } else {
      helper.textContent = 'Se esse email já estiver cadastrado, você receberá um link para entrar. Se não estiver, o link cria sua conta automaticamente.';
      submit.textContent = 'Enviar link';
    }
  },

  /**
   * handleLogin
   * - Captura o submit do formulário de e-mail e dispara o magic link.
   */
  async handleLogin(event) {
    event.preventDefault();
    // Se já houver sessão ativa, mostramos o card logado e evitamos reenviar Magic Link.
    const current = await DB.getSession();
    if (current.session?.user) {
      App.showToast('Você já está autenticado. Use “Trocar de conta” para acessar com outro email.');
      App.renderAuthUI(current.session);
      return;
    }

    if (App.state.isSendingOtp) {
      // Mensagem educativa para o rate limit de 3s imposto pelo Supabase.
      App.showToast('Por segurança, o sistema limita o envio de emails em sequência. Aguarde alguns segundos antes de solicitar um novo link.');
      return;
    }

    const email = (document.getElementById('email')?.value || '').trim();
    if (!email) {
      App.showToast('Informe um e-mail válido.');
      return;
    }

    const submitButton = event.target.querySelector('button[type="submit"]');
    App.state.isSendingOtp = true;
    if (submitButton) submitButton.disabled = true;

    try {
      const { error } = await DB.authSignIn(email);
      if (error) {
        if (error.status === 429) {
          App.showToast('Por segurança, o sistema limita o envio de emails em sequência. Aguarde alguns segundos antes de solicitar um novo link.');
        } else {
          App.showToast('Não conseguimos enviar o link. Tente novamente.');
        }
        console.error(error);
        return;
      }

      // Mensagem clara sobre OTP: se existir conta faz login; senão, cria.
      App.showToast('Enviamos um link para seu email. Se esse email já tiver cadastro, o link fará login. Caso contrário, o link criará sua conta automaticamente.');
      event.target.reset();
    } finally {
      // Cooldown mínimo para respeitar o rate limit (>=3s).
      setTimeout(() => {
        App.state.isSendingOtp = false;
        if (submitButton) submitButton.disabled = false;
      }, 3500);
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
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (event) => App.handleLogin(event));
  }

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
});
