const { withGradleProperties } = require('expo/config-plugins');

// Persist release optimizations when EAS regenerates the ignored android folder.
module.exports = config => withGradleProperties(config, config => {
  const settings = {
    'android.enableMinifyInReleaseBuilds': 'true',
    'android.enableShrinkResourcesInReleaseBuilds': 'true',
    'android.enableBundleCompression': 'true',
    'expo.useLegacyPackaging': 'true',
  };
  for (const [key, value] of Object.entries(settings)) {
    config.modResults = config.modResults.filter(item => item.type !== 'property' || item.key !== key);
    config.modResults.push({ type: 'property', key, value });
  }
  return config;
});
