const assert = require('node:assert/strict');
const config = require('../eas.json');
const expected = 'https://malikseserver.devoxa.in';
assert.equal(config.build.production.env.EXPO_PUBLIC_API_BASE_URL, expected);
if (process.env.EAS_BUILD_PROFILE === 'production' && process.env.EXPO_PUBLIC_API_BASE_URL) assert.equal(process.env.EXPO_PUBLIC_API_BASE_URL.replace(/\/$/, ''), expected, 'Production API origin must match the approved server');
console.log('Production API origin verified');
