const express = require('express');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const INTERNAL_PORT = Number(process.env.INTERNAL_BACKEND_PORT || (PORT === 3001 ? 3002 : 3001));
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase service credentials.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase().replace(/[.,;:\s]+$/g, '');
}
function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail(value));
}
function normalizeCode(value) {
  return String(value || '').trim().toUpperCase();
}
function normalizeAccess(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'aic' || text === 'aic-calculator' || text.includes('available fault current')) return 'aic';
  if (text === 'generator' || text.includes('optional method') || text.includes('generator')) return 'generator';
  if (text === 'both' || text === 'bundle' || text.includes('all calculator') || text.includes('two calculator') || text.includes('2 calculator')) return 'both';
  return '';
}
function trialCovers(trialAccess, requestedAccess) {
  if (!requestedAccess) return false;
  if (trialAccess === 'both') return true;
  if (requestedAccess === 'both') return false;
  return trialAccess === requestedAccess;
}
async function findTrial(email, code) {
  const { data, error } = await supabase
    .from('promo_trials')
    .select('id,email,promo_code,campaign_name,access_type,redeemed_at,expires_at,status')
    .eq('email', cleanEmail(email))
    .eq('promo_code', normalizeCode(code))
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
function activeTrial(trial) {
  return !!trial && trial.status === 'active' && new Date(trial.expires_at) > new Date();
}
function trialPayload(trial, message) {
  const access = normalizeAccess(trial.access_type) || 'both';
  return {
    success: true,
    active: true,
    trial: true,
    status: 'trial',
    message,
    email: cleanEmail(trial.email),
    promo_code: normalizeCode(trial.promo_code),
    campaign_name: trial.campaign_name,
    access_type: access,
    redeemed_at: trial.redeemed_at,
    expires_at: trial.expires_at,
    aic_access: access === 'both' || access === 'aic',
    generator_access: access === 'both' || access === 'generator'
  };
}

function proxyRequest(req) {
  return new Promise((resolve, reject) => {
    const body = (req.method === 'GET' || req.method === 'HEAD') ? '' : JSON.stringify(req.body || {});
    const headers = { ...req.headers, host: `127.0.0.1:${INTERNAL_PORT}` };
    delete headers['content-length'];
    if (body) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = Buffer.byteLength(body);
    }
    const upstream = http.request({
      hostname: '127.0.0.1',
      port: INTERNAL_PORT,
      path: req.originalUrl,
      method: req.method,
      headers
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode || 500,
        headers: response.headers,
        raw: Buffer.concat(chunks)
      }));
    });
    upstream.on('error', reject);
    if (body) upstream.write(body);
    upstream.end();
  });
}
async function proxyWithRetry(req) {
  try {
    return await proxyRequest(req);
  } catch (error) {
    if (error?.code !== 'ECONNREFUSED') throw error;
    await new Promise(resolve => setTimeout(resolve, 250));
    return proxyRequest(req);
  }
}
function sendUpstream(res, upstream) {
  const contentType = upstream.headers['content-type'];
  if (contentType) res.set('content-type', contentType);
  return res.status(upstream.status).send(upstream.raw);
}

app.get('/promo-health', async (req, res) => {
  try {
    const { error } = await supabase.from('promo_campaigns').select('id').limit(1);
    if (error) throw error;
    res.json({ status: 'ok', promoTrials: 'enabled', login: 'email-plus-code' });
  } catch (error) {
    console.error('Promo health failed:', error);
    res.status(500).json({ status: 'error', promoTrials: 'unavailable' });
  }
});

app.post('/api/promo/redeem', async (req, res) => {
  try {
    const email = cleanEmail(req.body?.email);
    const code = normalizeCode(req.body?.code || req.body?.promo_code);
    if (!validEmail(email)) return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    if (!code) return res.status(400).json({ success: false, message: 'Please enter a promotional code.' });

    const { data: campaign, error: campaignError } = await supabase
      .from('promo_campaigns')
      .select('id,promo_code,campaign_name,duration_hours,access_type,active,starts_at,ends_at')
      .eq('promo_code', code)
      .limit(1)
      .maybeSingle();
    if (campaignError) throw campaignError;
    if (!campaign || campaign.active !== true) return res.status(404).json({ success: false, message: 'This promotional code is not active.' });

    const now = new Date();
    if (campaign.starts_at && now < new Date(campaign.starts_at)) return res.status(403).json({ success: false, message: 'This promotional offer has not started yet.' });
    if (campaign.ends_at && now > new Date(campaign.ends_at)) return res.status(403).json({ success: false, message: 'This promotional offer has ended.' });

    const previous = await findTrial(email, code);
    if (previous) {
      if (activeTrial(previous)) {
        return res.json(trialPayload(previous, 'Welcome back. Your promotional trial is still active.'));
      }
      return res.status(409).json({
        success: false,
        active: false,
        already_redeemed: true,
        expired: true,
        message: 'Your promotional trial has ended.',
        expires_at: previous.expires_at
      });
    }

    const hours = Math.max(1, Number(campaign.duration_hours) || 24);
    const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
    const accessType = normalizeAccess(campaign.access_type) || 'both';
    const { data: trial, error: insertError } = await supabase
      .from('promo_trials')
      .insert({
        email,
        promo_code: code,
        campaign_name: campaign.campaign_name,
        access_type: accessType,
        redeemed_at: now.toISOString(),
        expires_at: expiresAt,
        status: 'active'
      })
      .select('id,email,promo_code,campaign_name,access_type,redeemed_at,expires_at,status')
      .single();
    if (insertError) throw insertError;

    return res.json(trialPayload(trial, `Your ${hours}-hour LoadCalcPro trial is active.`));
  } catch (error) {
    console.error('Promo redemption failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to activate the promotional trial right now.' });
  }
});

app.post('/api/promo/access', async (req, res) => {
  try {
    const email = cleanEmail(req.body?.email);
    const code = normalizeCode(req.body?.code || req.body?.promo_code);
    const requested = normalizeAccess(req.body?.calculator || req.body?.product || 'both');
    if (!validEmail(email) || !code || !requested) {
      return res.status(400).json({ success: false, active: false, message: 'Email, promotional code, and calculator are required.' });
    }
    const trial = await findTrial(email, code);
    if (!trial) return res.status(403).json({ success: false, active: false, message: 'Promotional trial not found.' });
    if (!activeTrial(trial)) return res.status(403).json({ success: false, active: false, expired: true, message: 'Your promotional trial has ended.', expires_at: trial.expires_at });
    const accessType = normalizeAccess(trial.access_type) || 'both';
    if (!trialCovers(accessType, requested)) return res.status(403).json({ success: false, active: false, message: 'This promotional trial does not include that calculator.' });
    return res.json({ ...trialPayload(trial, 'Promotional trial access approved.'), calculator: requested, allowed: true, access: true });
  } catch (error) {
    console.error('Promo access check failed:', error);
    return res.status(500).json({ success: false, active: false, message: 'Unable to verify promotional access right now.' });
  }
});

app.post('/api/access', async (req, res) => {
  try {
    const upstream = await proxyWithRetry(req);
    if (upstream.status < 400) return sendUpstream(res, upstream);
    const email = cleanEmail(req.body?.email);
    const code = normalizeCode(req.body?.code || req.body?.promo_code);
    const requested = normalizeAccess(req.body?.calculator || req.body?.product);
    if (!validEmail(email) || !code || !requested) return sendUpstream(res, upstream);
    const trial = await findTrial(email, code);
    if (!activeTrial(trial)) return sendUpstream(res, upstream);
    const accessType = normalizeAccess(trial.access_type) || 'both';
    if (!trialCovers(accessType, requested)) return sendUpstream(res, upstream);
    return res.json({ ...trialPayload(trial, 'Promotional trial access approved.'), calculator: requested, allowed: true, access: true });
  } catch (error) {
    console.error('Trial-aware legacy access failed:', error);
    return res.status(500).json({ active: false, message: 'Unable to verify access right now.' });
  }
});

app.use(async (req, res) => {
  try {
    const upstream = await proxyWithRetry(req);
    return sendUpstream(res, upstream);
  } catch (error) {
    console.error('Core backend proxy failed:', error);
    return res.status(502).json({ success: false, message: 'Access server is temporarily unavailable.' });
  }
});

const child = spawn(process.execPath, [path.join(__dirname, 'core-index.js')], {
  env: { ...process.env, PORT: String(INTERNAL_PORT) },
  stdio: 'inherit'
});
child.on('exit', (code, signal) => {
  console.error(`Core access server exited (code=${code}, signal=${signal || 'none'}).`);
  process.exit(code || 1);
});

const server = app.listen(PORT, () => {
  console.log(`LoadCalcPro promo gateway live on ${PORT}; core access server on ${INTERNAL_PORT}.`);
});

function shutdown(signal) {
  try { child.kill(signal); } catch (_) {}
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
