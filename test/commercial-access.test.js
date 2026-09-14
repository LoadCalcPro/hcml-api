'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'core-index.js'), 'utf8');

function extract(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `Could not extract ${startMarker}`);
  return source.slice(start, end);
}

const context = {};
vm.createContext(context);
vm.runInContext(extract('function normalizeAccessType', '\nfunction accessTypeFromProductName'), context);
vm.runInContext(extract('function memberAccessValues', '\nasync function setMemberAccess'), context);
vm.runInContext(extract('function memberCanUseCalculator', '\napp.get("/"'), context);

test('commercial aliases normalize to commercial access', () => {
  for (const value of ['commercial', 'commercial-calculator', 'commercial calculator']) {
    assert.equal(context.normalizeAccessType(value), 'commercial');
  }
});

test('active professional membership includes commercial calculator', () => {
  const member = { active: true, aic_access: true, generator_access: true };
  assert.equal(context.memberAccessValues(member).commercialAccess, true);
  assert.equal(context.memberCanUseCalculator(member, 'commercial'), true);
});

test('individual and inactive access do not unlock commercial calculator', () => {
  assert.equal(context.memberCanUseCalculator({ active: true, aic_access: true, generator_access: false }, 'commercial'), false);
  assert.equal(context.memberCanUseCalculator({ active: true, aic_access: false, generator_access: true }, 'commercial'), false);
  assert.equal(context.memberCanUseCalculator({ active: false, aic_access: true, generator_access: true }, 'commercial'), false);
});
