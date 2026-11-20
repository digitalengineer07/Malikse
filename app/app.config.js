module.exports = ({ config }) => {
  const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
  if (!androidMapsKey) return config;

  return {
    ...config,
    plugins: [...(config.plugins ?? []), ["react-native-maps", { androidGoogleMapsApiKey: androidMapsKey }]],
    extra: { ...config.extra, androidGoogleMapsConfigured: true },
  };
};
