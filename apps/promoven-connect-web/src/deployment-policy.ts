/** Remote backend activation requires a separate reviewed checkpoint. */
export function validateRemoteEnvironment(env: Record<string, string | undefined>): "preview" | "production" {
  const target = env.VERCEL_ENV;
  if (target !== "preview" && target !== "production") {
    throw new Error("Build remoto exige VERCEL_ENV=preview ou production.");
  }
  if (env.VITE_CONNECT_ENV !== target) {
    throw new Error("VITE_CONNECT_ENV deve corresponder ao ambiente Vercel.");
  }
  // No public credentials/endpoints are approved yet. Reject rather than log values.
  // Vercel injects VITE_VERCEL_* metadata; Vite's remote envPrefix=[] excludes it.
  if (Object.keys(env).some(key => key.startsWith("VITE_") && !key.startsWith("VITE_VERCEL_") && key !== "VITE_CONNECT_ENV" && env[key])) {
    throw new Error("Build remoto indisponível não aceita outras variáveis VITE_*.");
  }
  return target;
}

export function validateLocalEnvironment(env: Record<string, string | undefined>, hostname: string): void {
  if (env.VITE_CONNECT_ENV !== "local" || !["127.0.0.1", "localhost", "[::1]"].includes(hostname)) {
    throw new Error("O backend Connect está habilitado somente no ambiente local.");
  }
}
