module.exports = ({ config }) => {
  const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();

  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON?.trim();
  return {
    ...config,
    ...(googleServicesFile && { android: { ...config.android, googleServicesFile } }),
    ...(androidMapsKey && {
      plugins: [...(config.plugins ?? []), ["react-native-maps", { androidGoogleMapsApiKey: androidMapsKey }]],
    }),
    extra: {
      ...config.extra,
      ...(androidMapsKey && { androidGoogleMapsConfigured: true }),
      ...(googleServicesFile && { androidDeviceAlertsConfigured: true }),
    },
  };
};
