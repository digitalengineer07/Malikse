const express = require("express");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const app = express();
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  res.setHeader("Strict-Transport-Security", "max-age=31536000");
  res.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://maps.googleapis.com https://maps.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://malikseserver.devoxa.in https://maps.googleapis.com https://maps.gstatic.com https://indianopenmaps.com https://nominatim.openstreetmap.org; worker-src 'self' blob:; frame-src https://www.google.com");
  next();
});
const PORT = process.env.PORT || 8082;
const distDir = path.join(__dirname, "dist");
const indexPath = path.join(distDir, "index.html");

// Ensure web build exists
if (!fs.existsSync(indexPath)) {
  console.log("[MalikSe Website] dist/index.html not found. Building web bundle now...");
  try {
    execSync("npm run build", { stdio: "inherit", cwd: __dirname });
  } catch (err) {
    console.error("[MalikSe Website] Build step failed:", err.message);
  }
}

// Hash-named assets are immutable; entry HTML must pick up new deployments.
app.use(express.static(distDir, { maxAge: "1d", setHeaders(res, filePath) {
  if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
} }));

// Universal SPA fallback: use app.use() instead of app.get('*')
// This avoids Express 5 path-to-regexp v8 wildcard syntax error (TypeError: Missing parameter name at index 1: *)
app.use((req, res) => {
  if (fs.existsSync(indexPath)) {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexPath);
  } else {
    res.status(503).send("Website is building or dist/index.html is missing. Please refresh in a moment.");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[MalikSe Website] Live on http://0.0.0.0:${PORT}`);
});
