const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'reset-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'reset-test-refresh-secret';
process.env.OTP_STUB_CODE = '123456';
const { User } = require('../dist/models/User.model');
const { PasswordReset } = require('../dist/models/PasswordReset.model');
const router = require('../dist/routes/auth.routes').default;
const passwords = require('../dist/services/passwords').default;

(async () => {
  // Isolated local database; never load application environment or contact providers.
  await mongoose.connect('mongodb://127.0.0.1:27017/malikse_reset_test_' + Date.now(), { serverSelectionTimeoutMS: 3000 });
  let server;
  try {
    await Promise.all([User.init(), PasswordReset.init()]);
    const user = await User.create({ role: 'user', name: 'Reset Test', email: 'reset@example.test', passwordHash: await passwords.hash('Original!Forest82', 10) });
    const app = express(); app.use(express.json()); app.use('/auth', router);
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const post = async (path, body) => {
      const r = await fetch(`http://127.0.0.1:${server.address().port}/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { status: r.status, data: await r.json() };
    };
    const request = () => post('forgot-password', { identifier: user.email });
    let result = await request(); assert.equal(result.status, 200);
    const first = result.data.challengeId;
    assert.ok(!result.data.destination.includes('&'));
    assert.equal((await request()).status, 429);
    const reset = (challengeId, code = '123456') => post('reset-password', { challengeId, code, newPassword: 'New!Forest82Secure' });
    assert.equal((await reset(first, '000000')).status, 400);
    assert.equal((await reset(first, '1234567')).status, 400);
    assert.ok(await passwords.compare('Original!Forest82', (await User.findById(user._id)).passwordHash));
    await PasswordReset.updateOne({ challengeId: first }, { $set: { expiresAt: new Date(0), resendAt: new Date(0) } });
    assert.equal((await reset(first)).status, 400);
    const resends = await Promise.all([post('forgot-password/resend', { challengeId: first }), post('forgot-password/resend', { challengeId: first })]);
    assert.equal(resends.filter(r => r.status === 200).length, 1);
    const second = resends.find(r => r.status === 200).data.challengeId;
    assert.notEqual(first, second);
    assert.equal((await reset(first)).status, 400);
    // A Verify challenge must never accept the local digest, even if it matches.
    await PasswordReset.updateOne({ challengeId: second }, { $set: { provider: 'twilio-verify' } });
    assert.equal((await reset(second)).status, 400);
    await PasswordReset.updateOne({ challengeId: second }, { $set: { provider: 'local' } });
    const results = await Promise.all([reset(second), reset(second)]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
    assert.equal((await reset(second)).status, 400);
    assert.ok(await passwords.compare('New!Forest82Secure', (await User.findById(user._id)).passwordHash));
    assert.equal((await post('login', { email: user.email, password: 'Original!Forest82' })).status, 401);
    assert.equal((await post('login', { email: user.email, password: 'New!Forest82Secure' })).status, 200);
    delete process.env.OTP_STUB_CODE;
    process.env.TWILIO_ACCOUNT_SID = 'AC' + '1'.repeat(32);
    process.env.TWILIO_AUTH_TOKEN = 'test-token';
    process.env.TWILIO_VERIFY_SERVICE_SID = 'VA' + '2'.repeat(32);
    process.env.TWILIO_PHONE_NUMBER = '';
    const realFetch = global.fetch;
    let verificationChecks = 0;
    global.fetch = async (url, options) => {
      if (!String(url).startsWith('https://verify.twilio.com/')) return realFetch(url, options);
      if (String(url).endsWith('/VerificationCheck')) {
        verificationChecks++;
        return Response.json({ status: new URLSearchParams(options.body).get('Code') === '654321' ? 'approved' : 'pending' });
      }
      return Response.json({ sid: 'VE' + '3'.repeat(32) });
    };
    try {
      const mobileUser = await User.create({ role: 'user', name: 'SMS Reset', mobile: '9000000002', passwordHash: await passwords.hash('Original!Forest82', 10) });
      const sms = await post('forgot-password', { identifier: mobileUser.mobile });
      assert.equal(sms.status, 200);
      assert.equal((await PasswordReset.findOne({ challengeId: sms.data.challengeId })).provider, 'twilio-verify');
      assert.equal((await reset(sms.data.challengeId, '000000')).status, 400);
      assert.equal((await reset(sms.data.challengeId, '654321')).status, 200);
      assert.equal(verificationChecks, 2);
    } finally { global.fetch = realFetch; }
    console.log('PASS: email-only reset, invalid/expired OTP, resend throttling/concurrency, provider binding, single use, and password replacement');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
