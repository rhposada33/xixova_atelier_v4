import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { connectClient } from "./supabase";

interface AuthState { session: Session | null; loading: boolean; configurationError: string; signOut(): Promise<void>; }
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [configurationError, setConfigurationError] = useState("");
  useEffect(() => {
    let active = true;
    let client;
    try { client = connectClient(); } catch (error) { setConfigurationError(error instanceof Error ? error.message : "Configuração inválida."); setLoading(false); return; }
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, next) => { if (active) { setSession(next); setLoading(false); } });
    void client.auth.getSession().then(async ({ data, error }) => {
      if (!active) return;
      if (error || !data.session) { setSession(null); setLoading(false); return; }
      const verified = await client.auth.getUser();
      if (active) { setSession(verified.error ? null : data.session); setLoading(false); }
    }).catch(() => { if (active) { setSession(null); setLoading(false); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  const value = useMemo<AuthState>(() => ({ session, loading, configurationError, signOut: async () => { await connectClient().auth.signOut(); setSession(null); } }), [session, loading, configurationError]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("AuthProvider ausente."); return value; }
