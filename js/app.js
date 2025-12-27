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
   * - Em páginas protegidas (project.html, planner.html), redireciona quem não estiver autenticado.
   * - Mantém o visual leve sem criar telas novas: o retorno é para a home (index.html) para logar.
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
        <button class="btn ghost" type="button" onclick="App.focusLogin()">Entrar</button>
        <button class="btn primary" type="button" onclick="App.focusLogin()">Criar conta</button>
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

    App.showToast('Enviamos um link mágico para seu e-mail!');
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

  // Hook do formulário de login (index).
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (event) => App.handleLogin(event));
  }

  // Recupera sessão ativa e atualiza header.
  const { session } = await DB.getSession();
  App.state.user = session?.user ?? null;
  App.updateHeader(App.state.user);

  // Se estivermos em páginas protegidas, força autenticação.
  const protectedPage = location.pathname.endsWith('project.html') || location.pathname.endsWith('planner.html');
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
    }
  });
});
