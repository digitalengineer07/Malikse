const express = require("express");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const app = express();
const PORT = process.env.PORT || 8082;
const distDir = path.join(__dirname, "dist");
const indexPath = path.join(distDir, "index.html");

// Ensure web build exists
if (!fs.existsSync(indexPath)) {
  console.log("[MalikSe Website] dist/index.html not found. Building web bundle now...");
  try {
    execSync("npx expo export --platform web", { stdio: "inherit", cwd: __dirname });
  } catch (err) {
    console.error("[MalikSe Website] Build step failed:", err.message);
  }
}

// Serve static assets from dist with 1-day cache
app.use(express.static(distDir, { maxAge: "1d" }));

// Universal SPA fallback: use app.use() instead of app.get('*')
// This avoids Express 5 path-to-regexp v8 wildcard syntax error (TypeError: Missing parameter name at index 1: *)
app.use((req, res) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(503).send("Website is building or dist/index.html is missing. Please refresh in a moment.");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[MalikSe Website] Live on http://0.0.0.0:${PORT}`);
});
