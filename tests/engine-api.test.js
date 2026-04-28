const test = require('node:test');
const assert = require('node:assert/strict');

const api = require('../engine/stick-engine.js');

test('engine api exports expected factory and defaults', () => {
  assert.equal(typeof api.create, 'function');
  assert.equal(typeof api.DEFAULT_ACTIONS, 'object');
  assert.equal(typeof api.DEFAULT_POSES, 'object');
});
