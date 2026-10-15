const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createReviewEnvironment } = require('../../scripts/reviewEnvironment.cjs');
const { REVIEW_CSP } = require('./networkPolicy');

test('review startup removes service configuration from shell and every development dotenv file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reset-review-env-'));
  try {
    fs.writeFileSync(path.join(root, '.env'), 'REACT_APP_SUPABASE_URL=https://production.example\nSUPABASE_SERVICE_ROLE_KEY=never-use\nREACT_APP_PRIVATE_ENDPOINT=https://production.example\n');
    fs.writeFileSync(path.join(root, '.env.development.local'), 'STRIPE_SECRET_KEY=never-use\nREACT_APP_OTHER_KEY=never-use\n');
    const original = { REACT_APP_SUPABASE_ANON_KEY: 'never-use', NETLIFY_AUTH_TOKEN: 'never-use', STRIPE_WEBHOOK_SECRET: 'never-use', HOST: '0.0.0.0', PUBLIC_URL: 'https://production.example' };
    const result = createReviewEnvironment(original, root);
    expect(result).toMatchObject({
      NODE_ENV: 'development', HOST: '127.0.0.1', PORT: '3001', BROWSER: 'none', PUBLIC_URL: '',
      REACT_APP_SUPABASE_URL: 'https://review.invalid', REACT_APP_SUPABASE_ANON_KEY: 'review-only-not-a-credential',
      SUPABASE_SERVICE_ROLE_KEY: '', STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '', NETLIFY_AUTH_TOKEN: '',
      REACT_APP_PRIVATE_ENDPOINT: '', REACT_APP_OTHER_KEY: ''
    });
    expect(original.REACT_APP_SUPABASE_ANON_KEY).toBe('never-use');
    expect(fs.readFileSync(path.join(root, '.env'), 'utf8')).toContain('never-use');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('review CSP permits only local hot-reload connections and blocks forms and frames', () => {
  expect(REVIEW_CSP.split('; ').find(rule => rule.startsWith('connect-src'))).toBe('connect-src ws://localhost:* ws://127.0.0.1:*');
  expect(REVIEW_CSP).toContain("form-action 'none'");
  expect(REVIEW_CSP).toContain("frame-src 'none'");
});
