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
