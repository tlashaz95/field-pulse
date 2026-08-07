import test from 'node:test';
import assert from 'node:assert/strict';

test('holdings math sanity', () => {
  const authorised = 44;
  const held = Math.round(authorised * 0.95);
  const serviceable = Math.round(held * 0.9);
  assert.ok(serviceable <= held);
  assert.ok(held <= authorised + 1);
});

test('org levels', () => {
  const levels = ['division', 'group', 'brigade', 'battalion', 'hq'];
  assert.equal(levels.includes('brigade'), true);
});
