process.env.EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK = "1";

const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Force zustand and use-sync-external-store to use CJS builds
// which are compatible with Metro/Hermes on web
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Redirect zustand ESM to CJS
  if (moduleName === "zustand" || moduleName === "zustand/shallow") {
    return {
      filePath: path.resolve(__dirname, `node_modules/zustand/index.js`),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Block server-only Node.js packages from being bundled for web/native
config.resolver.blockList = [
  /node_modules\/mongoose\/.*/,
  /node_modules\/express\/.*/,
  /node_modules\/cors\/.*/,
  /node_modules\/multer\/.*/,
  /node_modules\/bcrypt\/.*/,
  /node_modules\/georaster\/.*/,
  /node_modules\/georaster-layer-for-leaflet\/.*/,
  /node_modules\/mapbox-gl\/.*/,
];

module.exports = config;
