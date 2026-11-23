import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), ["VITE_", "EXPO_PUBLIC_"]);
  const productionApi = "https://malikseserver.devoxa.in";
  let rawConfigured = (
    env.VITE_API_BASE_URL ||
    env.VITE_API_URL ||
    env.EXPO_PUBLIC_API_BASE_URL ||
    env.EXPO_PUBLIC_API_URL ||
    process.env.VITE_API_BASE_URL ||
    process.env.VITE_API_URL ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    ""
  )
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\/+$/, "");

  // Automatically upgrade insecure http:// to https:// for malikseserver.devoxa.in
  // to avoid browser Mixed Content blocking on https://malikse.devoxa.in
  if (/^http:\/\/malikseserver\.devoxa\.in$/i.test(rawConfigured)) {
    rawConfigured = productionApi;
  }

  // If accidentally configured with the frontend website domain or left empty, safely target production API
  const isFrontendDomain = /^(https?:\/\/)?malikse\.devoxa\.in\/?$/i.test(rawConfigured);
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(rawConfigured);

  let targetApi = productionApi;
  if (rawConfigured && !isFrontendDomain && !isLocalhost) {
    targetApi = rawConfigured;
  } else if (rawConfigured && isLocalhost) {
    targetApi = rawConfigured;
  }

  const proxyRoutes = [
    "/recommendations",
    "/properties",
    "/auth",
    "/users",
    "/inquiries",
    "/deals",
    "/documents",
    "/verification",
    "/admin",
    "/push",
    "/property-photos",
    "/account-deletion",
    "/regions",
  ];

  const proxyConfig = Object.fromEntries(
    proxyRoutes.map((route) => [
      route,
      {
        target: targetApi,
        changeOrigin: true,
        secure: false,
      },
    ])
  );

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
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify(targetApi),
    },
    server: {
      port: 8082,
      strictPort: false,
      proxy: proxyConfig,
    },
    envPrefix: ["VITE_", "EXPO_PUBLIC_"],
    build: { outDir: "dist", chunkSizeWarningLimit: 900 },
  };
});
