// Arquivo central de utilidades front-end.
// Mantemos tudo extremamente comentado para servir de guia didático para quem está começando em JS puro.

const App = {
  // Estado global mínimo: usuário autenticado e aba ativa.
  state: {
    user: null,
    currentTab: 'structure',
    toastTimer: null
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
   * redirectIfLoggedIn
   * - Usado na página de login (index.html) para mandar usuários autenticados direto para o app.
   */
  async redirectIfLoggedIn() {
    const { session } = await DB.getSession();
    if (session?.user) {
      App.state.user = session.user;
      App.navigate('app.html');
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
    logoutButton.onclick = async () => {
      await DB.authSignOut();
      App.state.user = null;
      App.updateHeader(null);
      App.showToast('Você saiu com segurança.');
      if (!location.pathname.endsWith('index.html')) App.navigate('index.html');
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
      helper.textContent = 'Você receberá um link no email para confirmar e criar a conta.';
      submit.textContent = 'Criar conta';
    } else {
      helper.textContent = 'Receba um link seguro para entrar.';
      submit.textContent = 'Enviar link';
    }
  },

  /**
   * handleLogin
   * - Captura o submit do formulário de e-mail e dispara o magic link.
   */
  async handleLogin(event) {
    event.preventDefault();
    const email = (document.getElementById('email')?.value || '').trim();
    if (!email) {
      App.showToast('Informe um e-mail válido.');
      return;
    }

    const { error } = await DB.authSignIn(email);
    if (error) {
      console.error(error);
      App.showToast('Não conseguimos enviar o link. Tente novamente.');
      return;
    }

    // Mensagem mais clara para evitar confusão com múltiplos links antigos.
    App.showToast('Enviamos um link para seu email. Abra o mais recente e clique nele em até alguns minutos.');
    event.target.reset();
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

  // Se estiver na página de login, redireciona usuários já autenticados para o app.
  const isAuthPage = location.pathname.endsWith('index.html') || location.pathname.endsWith('/');
  if (isAuthPage) {
    await App.redirectIfLoggedIn();
  }

  // Recupera sessão ativa e atualiza header.
  const { session } = await DB.getSession();
  App.state.user = session?.user ?? null;
  App.updateHeader(App.state.user);

  // Se estivermos em páginas protegidas, força autenticação.
  const protectedPage = location.pathname.endsWith('app.html') || location.pathname.endsWith('project.html') || location.pathname.endsWith('planner.html');
  if (protectedPage) {
    await App.requireAuth();
  }

  // Garante a criação/atualização do perfil ao receber uma nova sessão (ex.: magic link).
  DB.onAuthStateChange(async (_event, newSession) => {
    App.state.user = newSession?.user ?? null;
    App.updateHeader(App.state.user);
    if (newSession?.user) {
      await App.ensureProfile(newSession.user);
      App.showToast('Login concluído com sucesso.');
      // Se o login ocorreu na página de autenticação, encaminha para o app.
      const isAuthPage = location.pathname.endsWith('index.html') || location.pathname.endsWith('/');
      if (isAuthPage) App.navigate('app.html');
    }
  });
});
