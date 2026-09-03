'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const policy = require('../trial-policy');

test('new standard trials use 120 hours and day-based wording', () => {
  for (const value of [24, '24', 120, undefined, null, 0, '', 'invalid']) {
    assert.equal(policy.newTrialHours(value), 120);
  }
  assert.equal(policy.trialDurationLabel(120), '5-day');
  assert.equal(policy.newTrialHours(48), 48);
  assert.equal(policy.trialDurationLabel(6), '6-hour');
});

const now = new Date('2026-09-03T12:00:00.000Z');
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [now.getTime()])); }
  static now() { return now.getTime(); }
}

async function redeem(file, previous = null, duration = 24, active = true) {
  let handler;
  const inserted = [];
  const campaign = { duration_hours: duration, active, access_type: 'aic', campaign_name: 'standard' };
  const supabase = {
    from(table) {
      const query = {
        select() { return this; }, eq() { return this; }, limit() { return this; },
        async maybeSingle() { return { data: table === 'promo_campaigns' ? campaign : previous }; },
        insert(data) { inserted.push(data); this.data = data; return this; },
        async single() { return { data: { id: 'new', ...this.data } }; }
      };
      return query;
    }
  };
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const start = source.indexOf("app.post('/api/promo/redeem'");
  const end = source.indexOf('\napp.', start + 1);
  assert.ok(start >= 0 && end > start);
  vm.runInNewContext(source.slice(start, end), {
    app: { post(route, callback) { handler = callback; } },
    supabase, Date: Clock, console,
    cleanEmail: value => value.toLowerCase(), validEmail: () => true,
    normalizeCode: value => value.toUpperCase(), normalizeAccess: value => value,
    findTrial: async () => previous,
    activeTrial: trial => trial && trial.status === 'active' && new Date(trial.expires_at) > now,
    trialPayload: (trial, message) => ({ active: true, ...trial, message }),
    inviteIfNeeded: async () => ({ invited: false }),
    ...policy
  });
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ body: { email: 'test@example.invalid', code: 'test' } }, response);
  return { response, inserted };
}

for (const file of ['promo-entry.js', 'promo-proxy.js']) {
  test(`${file}: new legacy campaign redemption expires exactly five days later`, async () => {
    const { response, inserted } = await redeem(file);
    assert.equal(response.statusCode, 200);
    assert.equal(inserted.length, 1);
    assert.equal(inserted[0].expires_at, '2026-09-08T12:00:00.000Z');
    assert.equal(inserted[0].redeemed_at, now.toISOString());
    assert.equal(inserted[0].access_type, 'aic');
    assert.equal(response.body.message, 'Your 5-day LoadCalcPro trial is active.');
  });
  test(`${file}: returning active trial retains its original deadline`, async () => {
    const previous = { status: 'active', expires_at: '2026-09-04T00:00:00.000Z' };
    const { response, inserted } = await redeem(file, previous);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.expires_at, previous.expires_at);
    assert.equal(inserted.length, 0);
  });
  test(`${file}: expired trial is not restarted`, async () => {
    const previous = { status: 'active', expires_at: '2026-09-02T12:00:00.000Z' };
    const { response, inserted } = await redeem(file, previous);
    assert.equal(response.statusCode, 409);
    assert.equal(response.body.active, false);
    assert.equal(response.body.expires_at, previous.expires_at);
    assert.equal(inserted.length, 0);
  });
  test(`${file}: inactive campaign cannot issue a trial`, async () => {
    const { response, inserted } = await redeem(file, null, 24, false);
    assert.equal(response.statusCode, 404);
    assert.equal(inserted.length, 0);
  });
}
