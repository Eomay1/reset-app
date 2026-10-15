jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({ liveClient: true })) }));

const originalEnvironment = process.env.NODE_ENV;
const originalReview = process.env.REACT_APP_RESET_REVIEW;
afterEach(() => {
  process.env.NODE_ENV = originalEnvironment;
  if (originalReview === undefined) delete process.env.REACT_APP_RESET_REVIEW;
  else process.env.REACT_APP_RESET_REVIEW = originalReview;
  jest.resetModules();
});

test.each([undefined, 'false', 'true'])('development never constructs a live Supabase client with review flag %s', (flag) => {
  process.env.NODE_ENV = 'development';
  if (flag === undefined) delete process.env.REACT_APP_RESET_REVIEW;
  else process.env.REACT_APP_RESET_REVIEW = flag;
  jest.isolateModules(() => {
    const { createClient } = require('@supabase/supabase-js');
    createClient.mockClear();
    const { supabase } = require('../supabaseClient');
    expect(createClient).not.toHaveBeenCalled();
    expect(supabase.auth).toBeUndefined();
    expect(() => supabase.from('consumer_accounts')).toThrow();
  });
});

test('review flag cannot bypass production authentication or select review storage', () => {
  process.env.NODE_ENV = 'production';
  process.env.REACT_APP_RESET_REVIEW = 'true';
  jest.isolateModules(() => {
    const { isLocalReview, appStorage } = require('./reviewStorage');
    expect(isLocalReview).toBe(false);
    expect(appStorage).toBe(window.localStorage);
    const { supabase } = require('../supabaseClient');
    expect(supabase.liveClient).toBe(true);
  });
});


test('unmocked test imports fail closed to a local mock client', () => {
  process.env.NODE_ENV = 'test';
  jest.isolateModules(() => {
    const { createClient } = require('@supabase/supabase-js');
    createClient.mockClear();
    const { supabase } = require('../supabaseClient');
    expect(createClient).not.toHaveBeenCalled();
    expect(supabase.auth).toBeUndefined();
  });
});
