import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// On Replit, PORT and BASE_PATH are injected automatically.
// On any other server / local machine they fall back to sane defaults.
const isReplit = process.env.REPL_ID !== undefined;
const devPort  = Number(process.env.PORT ?? 5173);
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig(async ({ mode }) => {
  // loadEnv reads .env, .env.local, .env.[mode], .env.[mode].local
  // from the package directory so vite.config.ts can see non-VITE_ vars too.
  const env = loadEnv(mode, path.resolve(import.meta.dirname), "");

  // API proxy target:
  //  - In .env.local  → set  API_TARGET=https://your-replit-app.replit.app
  //  - On your server → set  API_TARGET=http://localhost:3001  (or leave unset)
  const apiTarget = env.API_TARGET ?? "http://localhost:3001";

  const replitPlugins = isReplit
    ? [
        (await import("@replit/vite-plugin-runtime-error-modal")).default(),
        await import("@replit/vite-plugin-cartographer").then((m) =>
          m.cartographer({ root: path.resolve(import.meta.dirname, "..") })
        ),
        await import("@replit/vite-plugin-dev-banner").then((m) =>
          m.devBanner()
        ),
      ]
    : [];

  return {
    base: basePath,

    plugins: [react(), tailwindcss(), ...replitPlugins],

    resolve: {
      alias: {
        "@":       path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },

    root: path.resolve(import.meta.dirname),

    build: {
      outDir:      path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react":  ["react", "react-dom"],
            "vendor-charts": ["recharts"],
            "vendor-query":  ["@tanstack/react-query"],
            "vendor-motion": ["framer-motion"],
            "vendor-icons":  ["lucide-react"],
            "vendor-radix":  [
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-tooltip",
              "@radix-ui/react-tabs",
              "@radix-ui/react-accordion",
            ],
          },
        },
      },
    },

    server: {
      port:         devPort,
      host:         "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
        deny:   ["**/.*"],
      },
      proxy: isReplit
        ? undefined
        : {
            "/api": {
              target:      apiTarget,
              changeOrigin: true,
              secure:       apiTarget.startsWith("https"),
              configure: (proxy) => {
                proxy.on("error", (err) => {
                  console.warn("[proxy] API error:", err.message);
                });
              },
            },
          },
    },

    preview: {
      port:         isReplit ? devPort : 4173,
      host:         "0.0.0.0",
      allowedHosts: true,
    },
  };
});
