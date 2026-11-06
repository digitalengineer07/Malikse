# MalikSe website

The website runs React with Vite and React Router. It has no Expo runtime, router, CLI or SDK dependencies. Existing interface components use React Native Web, which renders browser DOM; React Native is retained only as a development type dependency. The mobile app in `../app` is independent and still uses Expo.

## Run

```sh
npm ci
npm run dev
```

Development uses http://localhost:8082. Copy `.env.example` to `.env` and set `VITE_API_BASE_URL`. `VITE_` values are public build-time configuration; never put server secrets there. Existing website `EXPO_PUBLIC_` settings have been renamed to `VITE_`. Production hosting must use the new variable names and rebuild.

```sh
npm run typecheck
npm test
npm run build
npm start
```

The production build is `dist/`. `server.js` serves it and falls back to `index.html` for deep links. For other static hosts, configure the same SPA fallback. Do not cache index.html long-term; hashed assets may be cached.

## Structure

- `web/main.tsx`: React entry, lazy routes and session refresh.
- `web/navigation.tsx`: React Router navigation with existing URL and query compatibility.
- `web/files.ts`, `location.ts`, `storage.ts`, `crypto.ts`: browser APIs replacing native SDKs.
- `web/styles.css`: fonts, base layout and keyboard focus styling.
- `routes/`: public, account and staff/admin pages. `.web.tsx` takes priority where present.
- `components/` and `src/`: UI and backend services.

File selection uses browser input controls, location uses the browser permission prompt, and sessions retain the existing localStorage format. Public browsing and KYC/role gates remain enforced by the backend.

## Migration verification

The Vite production build includes TypeScript validation. Navigation compatibility tests cover protected-action return URLs, dynamic IDs, filters and deep links. Browser checks verified public recommendations, search/map, property routes and refresh, login with a synthetic local account, KYC gating, and file selection/upload to the isolated preview database. The dependency tree contains no Expo packages.
