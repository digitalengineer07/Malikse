import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig(({ mode, command }) => {
 const env = loadEnv(mode, process.cwd(), "VITE_");
 const configured = env.VITE_API_BASE_URL || env.VITE_API_URL;
 const productionApi = "https://malikseserver.devoxa.in";
 if (command === "build" && configured && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(configured) && configured.replace(/\/$/, "") !== productionApi) throw new Error("Production website API must be https://malikseserver.devoxa.in");
 return {
 plugins: [react()],
 resolve: { alias: [{find: /^react-native$/, replacement: "react-native-web"}, {find: "@", replacement: fileURLToPath(new URL(".", import.meta.url))}], extensions: [".web.tsx", ".web.ts", ".tsx", ".ts", ".js", ".json"] },
 define: { __DEV__: JSON.stringify(process.env.NODE_ENV !== "production"), global: "globalThis", ...(command === "build" ? { "import.meta.env.VITE_API_BASE_URL": JSON.stringify(productionApi) } : {}) },
 server: { strictPort: true },
 build: { outDir: "dist", chunkSizeWarningLimit: 900 }
};
});
