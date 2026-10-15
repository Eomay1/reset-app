const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

function createReviewEnvironment(environment, root) {
  const isolated = { ...environment };
  // Predefine sensitive keys so CRA's subsequent dotenv loading cannot restore
  // their values. Never print or copy .env contents into the review bundle.
  const keys = new Set(Object.keys(environment));
  for (const filename of ['.env', '.env.local', '.env.development', '.env.development.local']) {
    const file = path.join(root, filename);
    if (fs.existsSync(file)) Object.keys(dotenv.parse(fs.readFileSync(file))).forEach(key => keys.add(key));
  }
  for (const key of keys) {
    if (/^REACT_APP_|SUPABASE|STRIPE|^APP_URL$|^PUBLIC_URL$|^NETLIFY_/i.test(key)) isolated[key] = '';
  }
  return {
    ...isolated,
    NODE_ENV: 'development',
    BABEL_ENV: 'development',
    HOST: '127.0.0.1',
    PORT: environment.PORT || '3001',
    BROWSER: 'none',
    PUBLIC_URL: '',
    REACT_APP_SUPABASE_URL: 'https://review.invalid',
    REACT_APP_SUPABASE_ANON_KEY: 'review-only-not-a-credential',
    REACT_APP_SUPABASE_PUBLISHABLE_KEY: 'review-only-not-a-credential'
  };
}

module.exports = { createReviewEnvironment };
