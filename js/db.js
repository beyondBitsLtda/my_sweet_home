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

  // ---------------------------
  // CRUD de áreas (cômodos) — V1
  // ---------------------------

  async function createArea(area) {
    const supabase = initSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return { data: null, error: new Error('Usuário não autenticado') };

    // RLS protege, mas explicitamos o project_id enviado pelo front.
    console.info('createArea payload', area);
    return supabase.from('areas').insert(area).select().single();
  }

  async function listAreasByProject(projectId) {
    const supabase = initSupabase();
    console.info('listAreasByProject', projectId);
    return supabase
      .from('areas')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
  }

  async function updateArea(areaId, patch) {
    const supabase = initSupabase();
    console.info('updateArea', areaId, patch);
    return supabase.from('areas').update(patch).eq('id', areaId).select().single();
  }

  async function deleteArea(areaId) {
    const supabase = initSupabase();
    console.info('deleteArea', areaId);
    return supabase.from('areas').delete().eq('id', areaId);
  }

  // ---------------------------
  // CRUD de subáreas (novidade V1.1)
  // ---------------------------
  async function createSubArea(subArea) {
    const supabase = initSupabase();
    console.info('createSubArea payload', subArea);
    return supabase.from('sub_areas').insert(subArea).select().single();
  }

  async function listSubAreasByArea(areaId) {
    const supabase = initSupabase();
    console.info('listSubAreasByArea', areaId);
    return supabase
      .from('sub_areas')
      .select('*')
      .eq('area_id', areaId)
      .order('created_at', { ascending: false });
  }

  async function updateSubArea(subAreaId, patch) {
    const supabase = initSupabase();
    console.info('updateSubArea', subAreaId, patch);
    return supabase.from('sub_areas').update(patch).eq('id', subAreaId).select().single();
  }

  async function deleteSubArea(subAreaId) {
    const supabase = initSupabase();
    console.info('deleteSubArea', subAreaId);
    return supabase.from('sub_areas').delete().eq('id', subAreaId);
  }

  // ---------------------------
  // CRUD de cantos (corners)
  // ---------------------------
  async function createCorner(corner) {
    const supabase = initSupabase();
    console.info('createCorner payload', corner);
    return supabase.from('corners').insert(corner).select().single();
  }

  async function listCornersBySubArea(subAreaId) {
    const supabase = initSupabase();
    console.info('listCornersBySubArea', subAreaId);
    return supabase
      .from('corners')
      .select('*')
      .eq('sub_area_id', subAreaId)
      .order('created_at', { ascending: false });
  }

  async function updateCorner(cornerId, patch) {
    const supabase = initSupabase();
    console.info('updateCorner', cornerId, patch);
    return supabase.from('corners').update(patch).eq('id', cornerId).select().single();
  }

  async function deleteCorner(cornerId) {
    const supabase = initSupabase();
    console.info('deleteCorner', cornerId);
    return supabase.from('corners').delete().eq('id', cornerId);
  }

  // ---------------------------
  // CRUD de tarefas (V1)
  // ---------------------------
  async function createTask(task) {
    const supabase = initSupabase();
    // Compatibilidade: sempre gravamos scope_type/scope_id.
    // - area: scope_id = area_id
    // - sub_area: scope_id = sub_area_id
    // - corner: scope_id = corner_id
    const payload = { ...task };
    if (!payload.scope_type || !payload.scope_id) {
      console.warn('createTask sem scope explícito, aplicando padrão area');
      payload.scope_type = 'area';
      payload.scope_id = task.area_id;
    }
    console.info('createTask payload', payload);
    return supabase.from('tasks').insert(payload).select().single();
  }

  async function listTasksByProject(projectId, filter = {}) {
    const supabase = initSupabase();
    console.info('listTasksByProject', projectId, filter);
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (filter.scope_type) {
      query = query.eq('scope_type', filter.scope_type);
    }
    if (filter.scope_id) {
      query = query.eq('scope_id', filter.scope_id);
    }
    return query;
  }

  async function updateTaskStatus(taskId, status) {
    const supabase = initSupabase();
    console.info('updateTaskStatus', taskId, status);
    return supabase.from('tasks').update({ status }).eq('id', taskId).select().single();
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
    deleteProject,
    createArea,
    listAreasByProject,
    updateArea,
    deleteArea,
    createSubArea,
    listSubAreasByArea,
    updateSubArea,
    deleteSubArea,
    createCorner,
    listCornersBySubArea,
    updateCorner,
    deleteCorner,
    createTask,
    listTasksByProject,
    updateTaskStatus
  };
})();
