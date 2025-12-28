// Integração real com Supabase usando supabase-js via CDN.
// Mantemos comentários extensos para explicar cada decisão e servir de guia didático.

const DB = (() => {
  // Guardamos a instância do client em um closure para garantir singleton.
  let client = null;

  // Mapas de normalização para evitar violação de CHECK no Postgres.
  // Sempre aplicamos trim().toLowerCase() antes de mapear.
  const STATUS_MAP = {
    todo: 'todo',
    'to do': 'todo',
    'to-do': 'todo',
    'a fazer': 'todo',
    backlog: 'todo',
    doing: 'doing',
    'em andamento': 'doing',
    fazendo: 'doing',
    done: 'done',
    concluido: 'done',
    concluído: 'done',
    feito: 'done'
  };

  const WEIGHT_MAP = {
    light: 'light',
    leve: 'light',
    medium: 'medium',
    medio: 'medium',
    médio: 'medium',
    normal: 'medium',
    heavy: 'heavy',
    pesado: 'heavy',
    alta: 'heavy',
    alto: 'heavy'
  };

  function normalizeStatus(raw) {
    const key = (raw || '').toString().trim().toLowerCase();
    return STATUS_MAP[key] || null;
  }

  function normalizeWeight(raw) {
    const key = (raw || '').toString().trim().toLowerCase();
    return WEIGHT_MAP[key] || null;
  }

  /**
   * buildTaskPayload
   * - Centraliza a limpeza/normalização do payload para evitar violações de CHECK.
   * - Remove campos não permitidos e aplica defaults equivalentes aos do banco.
   */
  function buildTaskPayload(task, mode = 'insert') {
    const allowedKeys = [
      'project_id',
      'area_id',
      'scope_type',
      'scope_id',
      'title',
      'description',
      'status',
      'weight',
      'due_date',
      'cost_expected',
      'cost_real',
      'has_photo_before',
      'has_photo_after',
      'task_type'
    ];

    if (mode === 'insert') {
      const baseStatus = normalizeStatus(task?.status) || 'todo';
      const baseWeight = normalizeWeight(task?.weight) || 'medium';
      const scopeType = (task?.scope_type || 'area').trim();
      const scopeId = task?.scope_id || (scopeType === 'area' ? task?.area_id : null);
      if (!scopeId) return { error: new Error('scope_id obrigatório para criar tarefa') };
      const title = (task?.title || '').trim();
      if (!title) return { error: new Error('Título obrigatório') };

      const areaId = scopeType === 'area' ? (task?.area_id || scopeId) : task?.area_id || null;

      const cleaned = {
        project_id: task?.project_id || null,
        area_id: areaId,
        scope_type: scopeType,
        scope_id: scopeId,
        title,
        description: task?.description ? task.description.trim() : null,
        status: baseStatus,
        weight: baseWeight,
        due_date: task?.due_date || null,
        cost_expected: task?.cost_expected ?? 0,
        cost_real: task?.cost_real ?? 0,
        has_photo_before: Boolean(task?.has_photo_before),
        has_photo_after: Boolean(task?.has_photo_after)
      };
      if (task?.task_type) cleaned.task_type = task.task_type;
      return { payload: cleaned };
    }

    // mode === 'update' => apenas campos presentes, com normalização quando necessário.
    const patch = {};
    allowedKeys.forEach((k) => {
      if (task.hasOwnProperty(k)) {
        patch[k] = task[k];
      }
    });

    if (patch.hasOwnProperty('status')) {
      const normalized = normalizeStatus(patch.status);
      if (!normalized) return { error: new Error('Status inválido') };
      patch.status = normalized;
    }
    if (patch.hasOwnProperty('weight')) {
      const normalizedWeight = normalizeWeight(patch.weight);
      if (!normalizedWeight) return { error: new Error('Peso inválido') };
      patch.weight = normalizedWeight;
    }
    if (patch.hasOwnProperty('title')) {
      const title = (patch.title || '').trim();
      if (!title) return { error: new Error('Título obrigatório') };
      patch.title = title;
    }
    if (patch.hasOwnProperty('description')) {
      patch.description = patch.description ? patch.description.trim() : null;
    }
    if (patch.hasOwnProperty('has_photo_before')) {
      patch.has_photo_before = Boolean(patch.has_photo_before);
    }
    if (patch.hasOwnProperty('has_photo_after')) {
      patch.has_photo_after = Boolean(patch.has_photo_after);
    }
    if (patch.hasOwnProperty('cost_expected')) {
      patch.cost_expected = patch.cost_expected ?? 0;
    }
    if (patch.hasOwnProperty('cost_real')) {
      patch.cost_real = patch.cost_real ?? 0;
    }
    return { payload: patch };
  }

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
    const { payload, error: buildError } = buildTaskPayload(task, 'insert');
    if (buildError) return { data: null, error: buildError };
    console.log('TASK INSERT payload', payload);
    return supabase.from('tasks').insert([payload]).select('*').single();
  }

  async function updateTask(taskId, patch) {
    const supabase = initSupabase();
    const { payload, error: buildError } = buildTaskPayload(patch, 'update');
    if (buildError) return { data: null, error: buildError };
    console.log('TASK UPDATE patch', payload);
    return supabase.from('tasks').update(payload).eq('id', taskId).select('*').single();
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

  async function listTasksByScope({ projectId, scopeType, scopeId }) {
    const supabase = initSupabase();
    console.info('listTasksByScope', { projectId, scopeType, scopeId });
    let query = supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (projectId) query = query.eq('project_id', projectId);
    if (scopeType) query = query.eq('scope_type', scopeType);
    if (scopeId) query = query.eq('scope_id', scopeId);
    return query;
  }

  async function updateTaskStatus(taskId, status) {
    // Mantida para compatibilidade; aplica normalização e encaminha para updateTask.
    const normalized = normalizeStatus(status);
    if (!normalized) return { data: null, error: new Error('Status inválido') };
    return updateTask(taskId, { status: normalized });
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
    updateTask,
    listTasksByProject,
    listTasksByScope,
    updateTaskStatus,
    normalizeStatus,
    normalizeWeight,
    buildTaskPayload
  };
})();
