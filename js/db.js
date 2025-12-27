// Stubs do módulo de dados (Supabase).
// Mantemos apenas a assinatura das funções para guiar a futura implementação.
// Por que stubs? Para permitir que o front avance sem bloquear no backend.

const DB = {
  /**
   * Pretende inicializar o cliente Supabase no futuro.
   * Aqui retornamos null para reforçar que ainda não há conexão.
   */
  initClient() {
    // TODO: configurar supabase.createClient quando as chaves estiverem disponíveis.
    return null;
  },

  /**
   * Placeholder para autenticação. Deve receber email/senha ou magic link no futuro.
   */
  async signIn(email, password) {
    console.info('signIn stub chamado', email, password);
    return { user: null, error: null };
  },

  /**
   * Stub para buscar projetos do usuário.
   */
  async fetchProjects(userId) {
    console.info('fetchProjects stub chamado', userId);
    return [];
  },

  /**
   * Stub para salvar uma tarefa.
   */
  async upsertTask(task) {
    console.info('upsertTask stub chamado', task);
    return { data: task, error: null };
  }
};
