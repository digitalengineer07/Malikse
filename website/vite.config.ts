import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
 plugins: [react()],
 resolve: { alias: [{find: /^react-native$/, replacement: "react-native-web"}, {find: "@", replacement: fileURLToPath(new URL(".", import.meta.url))}], extensions: [".web.tsx", ".web.ts", ".tsx", ".ts", ".js", ".json"] },
 define: { __DEV__: JSON.stringify(process.env.NODE_ENV !== "production"), global: "globalThis" },
 server: { strictPort: true },
 build: { outDir: "dist", chunkSizeWarningLimit: 900 }
});
