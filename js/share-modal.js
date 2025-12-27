// Controlador defensivo do modal de compartilhamento.
// Objetivo: nunca quebrar a página caso os elementos não existam (ex.: telas que não usam o modal).
// Também envolve toda a inicialização em DOMContentLoaded para garantir que o DOM esteja disponível.

document.addEventListener('DOMContentLoaded', () => {
  // Seletores padrão usados pelo projeto; ajuste conforme o markup real.
  const modal = document.getElementById('share-modal');
  const openButtons = document.querySelectorAll('[data-open-share]');
  const closeButtons = document.querySelectorAll('[data-close-share]');
  const backdrop = modal || null;

  // Se não há modal definido, saímos silenciosamente sem registrar listeners.
  if (!modal) return;

  const show = () => {
    modal.classList.remove('hidden');
  };

  const hide = () => {
    modal.classList.add('hidden');
  };

  // Proteções: só adiciona listeners se existir ao menos um botão correspondente.
  if (openButtons && openButtons.length > 0) {
    openButtons.forEach((btn) => btn.addEventListener('click', show));
  }

  if (closeButtons && closeButtons.length > 0) {
    closeButtons.forEach((btn) => btn.addEventListener('click', hide));
  }

  // Clique no backdrop fecha o modal apenas se houver referência.
  if (backdrop) {
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) hide();
    });
  }
});
