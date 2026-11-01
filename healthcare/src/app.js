'use strict';
// MediCare+ Patient Records API - security-hardened service for the DevSecOps practical.
// Controls: API-key auth (from a Kubernetes Secret), PII masking, input validation,
// security headers, rate limiting, request size limits and structured audit logging.
const express = require('express');
const crypto = require('crypto');

const API_KEY = process.env.API_KEY || ''; // injected from a Kubernetes Secret, never hard-coded

const patients = [
  { id: 'P1001', name: 'Aarav Sharma', age: 34, gender: 'M', bloodGroup: 'B+', phone: '9876543210', aadhaar: '123412341234', ward: 'Cardiology' },
  { id: 'P1002', name: 'Diya Patel', age: 27, gender: 'F', bloodGroup: 'O+', phone: '9123456780', aadhaar: '567856785678', ward: 'Orthopaedics' },
  { id: 'P1003', name: 'Kabir Singh', age: 61, gender: 'M', bloodGroup: 'A-', phone: '9988776655', aadhaar: '901290129012', ward: 'Neurology' }
];

const mask = (s, keep = 4) => 'X'.repeat(Math.max(0, s.length - keep)) + s.slice(-keep);
const publicView = (p) => ({ ...p, phone: mask(p.phone), aadhaar: mask(p.aadhaar) });

function audit(req, event, extra = {}) {
  // Audit trail: who did what, never the medical record itself.
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, method: req.method, path: req.path, ip: req.ip, ...extra }));
}

function securityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cache-Control': 'no-store',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin'
  });
  next();
}

const hits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip;
  const rec = hits.get(key) || { count: 0, start: now };
  if (now - rec.start > 60000) { rec.count = 0; rec.start = now; }
  rec.count += 1;
  hits.set(key, rec);
  if (rec.count > 100) { audit(req, 'RATE_LIMITED'); return res.status(429).json({ error: 'Too many requests' }); }
  next();
}

function requireApiKey(req, res, next) {
  const given = Buffer.from(String(req.get('x-api-key') || ''));
  const expected = Buffer.from(API_KEY);
  const ok = API_KEY.length > 0 && given.length === expected.length && crypto.timingSafeEqual(given, expected);
  if (!ok) { audit(req, 'AUTH_FAILED'); return res.status(401).json({ error: 'Unauthorized' }); }
  next();
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', false);
app.use(securityHeaders);
app.use(rateLimit);
app.use(express.json({ limit: '5kb' }));

app.get('/health', (req, res) => res.json({ status: 'UP' }));

app.get('/', (req, res) => {
  res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>MediCare+ Records API</title>
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 16px;color:#0f172a">
<h1 style="color:#0f766e">🏥 MediCare+ Patient Records API</h1>
<p>Secure healthcare micro-service deployed through a DevSecOps pipeline (Gitleaks → Semgrep → npm audit/Trivy → Trivy image &amp; IaC scan → hardened Kubernetes → OWASP ZAP).</p>
<ul><li><code>GET /health</code> – public liveness check</li>
<li><code>GET /api/patients</code> – requires <code>x-api-key</code>; PII (phone, Aadhaar) is masked</li>
<li><code>GET /api/patients/:id</code> – requires <code>x-api-key</code></li>
<li><code>POST /api/patients</code> – requires <code>x-api-key</code>; strict input validation</li></ul>
<p style="color:#64748b">Runs as non-root with a read-only filesystem, all Linux capabilities dropped and a default-deny NetworkPolicy.</p>
</body></html>`);
});

app.get('/api/patients', requireApiKey, (req, res) => {
  audit(req, 'PATIENT_LIST', { count: patients.length });
  res.json(patients.map(publicView));
});

app.get('/api/patients/:id', requireApiKey, (req, res) => {
  if (!/^P\d{4}$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid patient id' });
  const p = patients.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  audit(req, 'PATIENT_READ', { patientId: p.id });
  res.json(publicView(p));
});

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
app.post('/api/patients', requireApiKey, (req, res) => {
  const b = req.body || {};
  const errors = [];
  if (typeof b.name !== 'string' || !/^[A-Za-z .'-]{2,60}$/.test(b.name)) errors.push('name');
  if (!Number.isInteger(b.age) || b.age < 0 || b.age > 120) errors.push('age');
  if (!['M', 'F', 'O'].includes(b.gender)) errors.push('gender');
  if (!BLOOD.includes(b.bloodGroup)) errors.push('bloodGroup');
  if (typeof b.phone !== 'string' || !/^[6-9]\d{9}$/.test(b.phone)) errors.push('phone');
  if (typeof b.aadhaar !== 'string' || !/^\d{12}$/.test(b.aadhaar)) errors.push('aadhaar');
  if (errors.length) return res.status(400).json({ error: 'Validation failed', fields: errors });
  const p = { id: `P${1001 + patients.length}`, name: b.name, age: b.age, gender: b.gender, bloodGroup: b.bloodGroup, phone: b.phone, aadhaar: b.aadhaar, ward: 'General' };
  patients.push(p);
  audit(req, 'PATIENT_CREATE', { patientId: p.id });
  res.status(201).json(publicView(p));
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
// Generic error handler: never leak stack traces
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => { audit(req, 'ERROR', { code: err.status || 500 }); res.status(err.status || 500).json({ error: 'Request failed' }); });

module.exports = app;
