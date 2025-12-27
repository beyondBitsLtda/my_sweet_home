// Integração real com Supabase usando supabase-js via CDN.
// Mantemos comentários extensos para explicar cada decisão e servir de guia didático.

const DB = (() => {
  // Guardamos a instância do client em um closure para garantir singleton.
  let client = null;

  /**
   * initSupabase
   * - Cria o client apenas uma vez com as credenciais públicas fornecidas.
   * - Em projetos estáticos, a lib já está disponível no escopo global via CDN (script em cada HTML).
   */
  function initSupabase() {
    if (client) return client; // evita recriar em cada chamada

    const SUPABASE_URL = 'https://npdtasfbuseyakpglekz.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_PqiJanBNf49_tHPiz4hSgw_c24UbyNL';

    // O supabase global é exposto pela versão UMD carregada no HTML.
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return client;
  }

  // Fluxos baseados em email+senha (substituindo o OTP para este cenário).
  async function authSignInWithPassword(email, password) {
    const supabase = initSupabase();
    return supabase.auth.signInWithPassword({ email, password });
  }

  async function authSignUp(email, password) {
    const supabase = initSupabase();
    const baseUrl = new URL('./', window.location.href);
    const redirectTo = new URL('index.html', baseUrl).toString();
    return supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo
      }
    });
  }

  async function authResetPassword(email) {
    const supabase = initSupabase();
    // Usa redirect para index.html, onde o usuário pode redefinir (fluxo simplificado).
    const baseUrl = new URL('./', window.location.href);
    const redirectTo = new URL('index.html', baseUrl).toString();
    return supabase.auth.resetPasswordForEmail(email, { redirectTo });
  }

  /** Faz logout limpando a sessão atual. */
  async function authSignOut() {
    const supabase = initSupabase();
    const { error } = await supabase.auth.signOut();
    return { error };
  }

  /** Recupera a sessão ativa (se existir). */
  async function getSession() {
    const supabase = initSupabase();
    const { data, error } = await supabase.auth.getSession();
    return { session: data?.session ?? null, error };
  }

  // ---------------------------
  // CRUD de projetos (V1)
  // ---------------------------

  async function createProject(project) {
    const supabase = initSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return { data: null, error: new Error('Usuário não autenticado') };
    const payload = { ...project, user_id: userId };
    console.info('createProject payload', payload);
    return supabase.from('projects').insert(payload).select().single();
  }

  async function listProjects(userId) {
    const supabase = initSupabase();
    console.info('listProjects for user', userId);
    return supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
  }

  async function getProjectById(id) {
    const supabase = initSupabase();
    console.info('getProjectById', id);
    return supabase.from('projects').select('*').eq('id', id).single();
  }

  /**
   * deleteProject
   * - Exclui um projeto pertencente ao usuário logado.
   * - Mesmo com RLS ativo, filtramos por user_id para reforçar a intenção (defesa em profundidade).
   */
  async function deleteProject(projectId) {
    const supabase = initSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return { data: null, error: new Error('Usuário não autenticado') };

    console.info('deleteProject', projectId, 'user', userId);
    return supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', userId);
  }

  /**
   * Escuta mudanças de autenticação.
   * - Ideal para reagir a magic link ou logout em múltiplas abas.
   */
  function onAuthStateChange(callback) {
    const supabase = initSupabase();
    return supabase.auth.onAuthStateChange(callback);
  }

  /**
   * upsertProfile
   * - Garante que a tabela users_profile tenha um registro para o usuário autenticado.
   * - RLS/policies devem estar configuradas no Supabase; aqui apenas chamamos a API pública.
   * - display_name usa e-mail como fallback para manter algo legível no header.
   */
  async function upsertProfile(user) {
    if (!user) return { error: new Error('Usuário ausente na upsertProfile') };

    const supabase = initSupabase();
    const payload = {
      id: user.id,
      display_name: user.email,
      total_points_lifetime: 0
    };

    const { error } = await supabase
      .from('users_profile')
      .upsert(payload, { onConflict: 'id' });

    return { error };
  }

  return {
    initSupabase,
    authSignInWithPassword,
    authSignUp,
    authResetPassword,
    authSignOut,
    getSession,
    onAuthStateChange,
    upsertProfile,
    createProject,
    listProjects,
    getProjectById,
    deleteProject
  };
})();
