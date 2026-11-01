const { withGradleProperties, withAppBuildGradle } = require('expo/config-plugins');

const envInputs = `
// Track Expo environment changes when deciding whether to rebuild the JS bundle.
tasks.withType(com.facebook.react.tasks.BundleHermesCTask).configureEach {
    inputs.files(fileTree(rootProject.projectDir.parentFile) { include '.env', '.env.*' })
    inputs.properties(System.getenv().findAll { key, value ->
        key.startsWith('EXPO_PUBLIC_') || key in ['NODE_ENV', 'EXPO_NO_DOTENV', 'EXPO_NO_CLIENT_ENV_VARS']
    })
}
`;

// Persist release optimizations when EAS regenerates the ignored android folder.
module.exports = config => {
  config = withAppBuildGradle(config, config => {
    if (!config.modResults.contents.includes('// Track Expo environment changes')) {
      config.modResults.contents += envInputs;
    }
    return config;
  });
  return withGradleProperties(config, config => {
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
};
