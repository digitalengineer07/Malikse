const fs = require('node:fs');
const path = require('node:path');
const apk = path.resolve(process.argv[2] || 'android/app/build/outputs/apk/release/app-release.apk');
const bytes = fs.statSync(apk).size;
console.log(`${apk}: ${(bytes / 1000000).toFixed(2)} MB (${(bytes / 1048576).toFixed(2)} MiB)`);
if (bytes >= 50000000) {
  console.error('APK exceeds the 50 MB download budget.');
  process.exitCode = 1;
}
