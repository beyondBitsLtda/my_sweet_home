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

  /**
   * authSignIn
   * - Fluxo mais simples e seguro para frontend puro: magic link via e-mail.
   * - O Supabase envia o link para o endereço informado; não manipulamos senhas no browser.
   * - IMPORTANTE: definimos emailRedirectTo dinamicamente para funcionar tanto em localhost quanto em GitHub Pages.
   */
  async function authSignIn(email) {
    const supabase = initSupabase();
    // Calculamos a raiz do site com base na URL atual.
    // Usamos new URL('./', window.location.href) para obter o diretório onde o index.html vive.
    // Isso evita redirecionamentos quebrados em ambientes estáticos (ex.: https://usuario.github.io/repo/).
    // Em seguida, definimos explicitamente o arquivo index.html, já que o hash de retorno é processado lá.
    const baseUrl = new URL('./', window.location.href);
    const redirectTo = new URL('index.html', baseUrl).toString();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo
      }
    });
    return { error };
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
    authSignIn,
    authSignOut,
    getSession,
    onAuthStateChange,
    upsertProfile
  };
})();
