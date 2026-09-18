import { createReadStream, statSync } from "node:fs";
import { resolve, relative, sep } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
const mime = (path: string) =>
  path.endsWith(".json")
    ? "application/json"
    : path.endsWith(".glb")
      ? "model/gltf-binary"
      : path.endsWith(".png")
        ? "image/png"
        : path.endsWith(".svg")
          ? "image/svg+xml"
          : path.endsWith(".hdr")
            ? "application/octet-stream"
            : undefined;
function catalogFallback(): Plugin {
  return {
    name: "xixova-catalog-fallback",
    configureServer(server) {
      const configured = process.env.VITE_E2E_PUBLIC_DIR;
      // El catálogo publicado vive fuera de `public/`. En desarrollo se usa
      // como origen local por defecto; E2E puede sustituirlo explícitamente.
      const root = resolve(
        configured ?? "../../publicaciones/catalogo_xixova",
      );
      try {
        if (!statSync(root).isDirectory()) return;
      } catch {
        return;
      }
      server.middlewares.use((request, response, next) => {
          const pathname = decodeURIComponent(
            (request.url || "/").split("?")[0],
          );
          // Nunca entregue el index precompilado del catálogo: Vite debe
          // transformar el index fuente y resolver las rutas de la SPA.
          if (!/\.(json|glb|png|svg|hdr|wasm)$/i.test(pathname)) return next();
          const file = resolve(root, `.${pathname}`),
            rel = relative(root, file);
          if (rel.startsWith(`..${sep}`) || rel === "..") return next();
          try {
            if (!statSync(file).isFile()) return next();
            const type = mime(file);
            if (type) response.setHeader("Content-Type", type);
            createReadStream(file).pipe(response);
          } catch {
            next();
          }
        });
    },
  };
}
export default defineConfig({
  plugins: [react(), catalogFallback()],
  base: "/",
  publicDir: "public",
  build: {
    assetsDir: "assets",
    rolldownOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        demo: resolve(__dirname, "demo.html"),
        privacidade: resolve(__dirname, "privacidade.html"),
      },
      output: {
        codeSplitting: {
          groups: [
            { name: "three", test: /node_modules\/three\//, priority: 20 },
            {
              name: "supabase",
              test: /node_modules\/@supabase\//,
              priority: 20,
            },
            { name: "portal", test: /src\/portal\//, priority: 10 },
          ],
        },
      },
    },
  },
});
