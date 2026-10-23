import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
export function connectClient(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_CONNECT_SUPABASE_URL;
  const key = import.meta.env.VITE_CONNECT_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Configure o Supabase Connect local para acessar o portal.");
  if (import.meta.env.VITE_CONNECT_ENV === "local" && url !== "http://127.0.0.1:56321") {
    throw new Error("O ambiente local deve usar somente o Supabase Connect isolado.");
  }
  const functionsUrl = import.meta.env.VITE_CONNECT_FUNCTIONS_URL;
  if (!functionsUrl) throw new Error("Configure o proxy confiável das funções Connect.");
  if (import.meta.env.VITE_CONNECT_ENV === "local" && functionsUrl !== "http://127.0.0.1:56410") {
    throw new Error("O proxy local deve usar somente o Connect isolado.");
  }
  client = createClient(url, key, { global: { fetch: (input, init) => {
    const source = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (source.startsWith(`${url}/functions/v1/`)) {
      const target = functionsUrl + source.slice(url.length);
      return fetch(input instanceof Request ? new Request(target, input) : target, init);
    }
    return fetch(input, init);
  } }, auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } });
  return client;
}
