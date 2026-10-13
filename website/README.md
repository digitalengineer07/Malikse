# MalikSe — Standalone Website

This directory contains the standalone web application for MalikSe, decoupled from the mobile app codebase in `../app`.

## Quick Start

```bash
# Install dependencies (if not already installed)
npm install

# Start website dev server (running on port 8082)
npm run dev
# or
npm start
```

- Any UI changes made in `website/` only affect the website and will not impact `app/`.
- Backend API endpoints are consumed from `http://localhost:5000` (configured in `.env`).

