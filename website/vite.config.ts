import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const productionApi = "https://malikseserver.devoxa.in";
  const rawConfigured = (env.VITE_API_BASE_URL || env.VITE_API_URL || process.env.VITE_API_BASE_URL || process.env.VITE_API_URL || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\/+$/, "");

  // If accidentally configured with the frontend website domain or left empty, safely target production API
  const isFrontendDomain = /^(https?:\/\/)?malikse\.devoxa\.in\/?$/i.test(rawConfigured);
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(rawConfigured);

  let targetApi = productionApi;
  if (command !== "build" && (isLocalhost || rawConfigured)) {
    targetApi = rawConfigured || "http://localhost:5000";
  } else if (rawConfigured && !isFrontendDomain && !isLocalhost) {
    targetApi = rawConfigured;
  }

  return {
    plugins: [react()],
    resolve: {
      alias: [
        { find: /^react-native$/, replacement: "react-native-web" },
        { find: "@", replacement: fileURLToPath(new URL(".", import.meta.url)) },
      ],
      extensions: [".web.tsx", ".web.ts", ".tsx", ".ts", ".js", ".json"],
    },
    define: {
      __DEV__: JSON.stringify(process.env.NODE_ENV !== "production"),
      global: "globalThis",
      ...(command === "build" ? { "import.meta.env.VITE_API_BASE_URL": JSON.stringify(targetApi) } : {}),
    },
    server: { strictPort: true },
    build: { outDir: "dist", chunkSizeWarningLimit: 900 },
  };
});
