import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, normalisePhone, makeRef, MAX_MEMBERS } from '../api/_lib/validate.js';

const member = (n, extra = {}) => ({
  name: `Member ${n}`,
  branch: 'CSE A',
  phone: `98765432${String(n).padStart(2, '0')}`,
  ...extra
});
const team = (members, extra = {}) => ({ teamName: 'Night Owls', members, ...extra });
const three = () => [member(1), member(2), member(3)];

test('accepts a valid three-member team and fills in the fixed roles', () => {
  const { entry, error } = validate(team(three()));
  assert.equal(error, undefined);
  assert.deepEqual(entry.members.map((m) => m.role), ['Team Lead', 'Presentation Maker', 'Researcher']);
  assert.match(entry.ref, /^ID60-NIG-\d{4}$/);
});

test('accepts a fourth member only in one of the optional roles', () => {
  assert.ok(validate(team([...three(), member(4, { role: 'Problem Analyst' })])).entry);
  assert.equal(validate(team([...three(), member(4)])).field, 'member4Role');
  assert.equal(validate(team([...three(), member(4, { role: 'Team Lead' })])).field, 'member4Role');
});

test('rejects a member claiming a different fixed role', () => {
  const members = three();
  members[0].role = 'Researcher';
  assert.equal(validate(team(members)).field, 'member1Role');
});

test('enforces team size limits', () => {
  assert.equal(validate(team(three().slice(0, 2))).field, 'members');
  const tooMany = Array.from({ length: MAX_MEMBERS + 1 }, (_, i) => member(i + 1));
  assert.equal(validate(team(tooMany)).field, 'members');
});

test('rejects duplicate names case-insensitively and duplicate phones after normalising', () => {
  const dupName = three();
  dupName[2].name = 'MEMBER 1';
  assert.equal(validate(team(dupName)).field, 'member3Name');

  const dupPhone = three();
  dupPhone[1].phone = '+91 ' + dupPhone[0].phone;
  assert.equal(validate(team(dupPhone)).field, 'member2Phone');
});

test('rejects unknown branches, blank and over-long names', () => {
  const badBranch = three();
  badBranch[1].branch = 'Civil';
  assert.equal(validate(team(badBranch)).field, 'member2Branch');
  assert.equal(validate(team(three(), { teamName: '   ' })).field, 'teamName');
  assert.equal(validate(team(three(), { teamName: 'x'.repeat(61) })).field, 'teamName');
});

test('rejects bots that fill the honeypot field', () => {
  assert.equal(validate(team(three(), { website: 'http://spam' })).field, 'website');
});

test('rejects malformed bodies without throwing', () => {
  assert.ok(validate(null).error);
  assert.ok(validate('nope').error);
  assert.equal(validate({ teamName: 'A', members: 'x' }).field, 'members');
});

test('normalisePhone accepts common Indian formats and rejects everything else', () => {
  for (const raw of ['9876543210', '+91 98765 43210', '919876543210', '09876543210']) {
    assert.equal(normalisePhone(raw), '9876543210', raw);
  }
  for (const raw of ['12345', '98765432101', '', null, undefined]) {
    assert.equal(normalisePhone(raw), '', String(raw));
  }
});

test('makeRef pads short or symbol-only team names', () => {
  assert.match(makeRef('A'), /^ID60-AXX-\d{4}$/);
  assert.match(makeRef('!!'), /^ID60-XXX-\d{4}$/);
});
