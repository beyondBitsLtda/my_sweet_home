// Arquivo central de utilidades front-end.
// Mantemos tudo extremamente comentado para servir de guia didático para quem está começando em JS puro.

// Estado global mínimo: apenas flags de sessão e abas selecionadas.
// A escolha por um objeto simples evita dependências e facilita leitura.
const App = {
  state: {
    user: null,
    currentTab: 'structure'
  },

  // Navegação básica entre páginas HTML estáticas.
  // Preferimos window.location para alinhar com o escopo de um site estático (GitHub Pages).
  navigate(target) {
    window.location.href = target;
  },

  // Tab switching simples: esconde painéis e ativa o botão clicado.
  switchTab(event) {
    const tabName = event?.target?.dataset?.tab;
    if (!tabName) return;

    // Guardamos o estado para futura persistência (localStorage, se desejado).
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

    // Mantemos a referência do timeout para evitar acumular timers em múltiplas chamadas.
    clearTimeout(App.state.toastTimer);
    App.state.toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, duration);
  }
};

// Inicialização simples: registra listeners que não dependem de dados externos.
// O objetivo é demonstrar o encadeamento de funções sem frameworks.
document.addEventListener('DOMContentLoaded', () => {
  // Resgata a aba ativa se o usuário já navegou antes (como exercício opcional).
  const savedTab = App.state.currentTab;
  const defaultTabButton = document.querySelector(`.tab[data-tab="${savedTab}"]`);
  if (defaultTabButton) {
    defaultTabButton.click();
  }

  // Exemplos de acionadores de feedback visual.
  const toastTrigger = document.querySelector('[data-demo-toast]');
  toastTrigger?.addEventListener('click', () => App.showToast('Toast de exemplo'));
});
