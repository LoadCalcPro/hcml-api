'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'core-index.js'), 'utf8');
const start = source.indexOf('function accessTypeFromProductName');
const end = source.indexOf('\nfunction requireAdminKey', start);
assert.ok(start >= 0 && end > start);

const context = {};
vm.runInNewContext(`${source.slice(start, end)}\nthis.accessTypeFromProductName = accessTypeFromProductName;`, context);
const accessTypeFromProductName = context.accessTypeFromProductName;

test('LoadCalcPro X membership grants access to every calculator', () => {
  assert.equal(accessTypeFromProductName('LoadCalcPro X Professional Membership'), 'both');
  assert.equal(accessTypeFromProductName('  LOADCALCPRO X PROFESSIONAL MEMBERSHIP  '), 'both');
});

test('existing Payhip product mappings remain unchanged', () => {
  assert.equal(accessTypeFromProductName('Available Fault Current (AIC) Calculator'), 'aic');
  assert.equal(accessTypeFromProductName('Optional Method Generator Calculator'), 'generator');
  assert.equal(accessTypeFromProductName('Complete Electrical Calculation Suite'), '');
  assert.equal(accessTypeFromProductName('LoadCalcPro Professional Membership'), 'generator');
});
