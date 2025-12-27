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
    return supabase.auth.signUp({ email, password });
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
    upsertProfile
  };
})();
