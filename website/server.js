const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 8082;
const distDir = path.join(__dirname, "dist");

// Serve static assets from dist with caching
app.use(express.static(distDir, { maxAge: "1d" }));

// Fallback to index.html for Single Page Application (SPA) routing
app.get("*", (req, res) => {
  const indexPath = path.join(distDir, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(503).send("Website is building or dist/index.html is missing.");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[MalikSe Website] Live on http://0.0.0.0:${PORT}`);
});
