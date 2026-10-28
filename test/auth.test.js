import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { checkPassword, makeToken, verifyToken } from '../api/_lib/auth.js';

beforeEach(() => {
  process.env.ADMIN_PASSWORD = 'correct horse battery staple';
  delete process.env.ADMIN_SESSION_SECRET;
});

test('checkPassword accepts only the configured password', () => {
  assert.equal(checkPassword('correct horse battery staple'), true);
  assert.equal(checkPassword('wrong'), false);
  assert.equal(checkPassword(undefined), false);
});

test('checkPassword fails closed when no password is configured', () => {
  delete process.env.ADMIN_PASSWORD;
  assert.equal(checkPassword(''), false);
});

test('a freshly minted token verifies', () => {
  assert.equal(verifyToken(makeToken()), true);
});

test('a token with a tampered expiry or signature is rejected', () => {
  const [v, exp, sig] = makeToken().split('.');
  assert.equal(verifyToken(`${v}.${Number(exp) + 3600}.${sig}`), false);
  const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
  assert.equal(verifyToken(`${v}.${exp}.${flipped}`), false);
});

test('an expired token is rejected even with a valid signature', (t) => {
  const realNow = Date.now;
  t.after(() => { Date.now = realNow; });
  Date.now = () => realNow() - 9 * 60 * 60 * 1000; // mint 9 h ago; TTL is 8 h
  const token = makeToken();
  Date.now = realNow;
  assert.equal(verifyToken(token), false);
});

test('changing the password invalidates existing sessions', () => {
  const token = makeToken();
  process.env.ADMIN_PASSWORD = 'a new password';
  assert.equal(verifyToken(token), false);
});

test('malformed tokens are rejected without throwing', () => {
  for (const t of [undefined, '', 'v1', 'v2.1.x', 'v1.notanumber.sig', 42]) {
    assert.equal(verifyToken(t), false, String(t));
  }
});
