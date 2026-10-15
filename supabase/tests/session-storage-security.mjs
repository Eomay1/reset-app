import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const runtimeDir = process.env.RESET_PGLITE_DIR;
if (!runtimeDir) throw new Error('Set RESET_PGLITE_DIR to the isolated temporary PGlite installation.');
const requireRuntime = createRequire(resolve(runtimeDir, 'package.json'));
const { PGlite } = requireRuntime('@electric-sql/pglite');
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../../', import.meta.url));
const paths = ['202608270001_consumer_auth_foundation.sql', '202609030001_consumer_trial_entitlements.sql', '202610090000_session_results_deny_anon_insert.sql', '202610090001_session_exercise_metadata.sql'];
const sql = paths.map(p => readFileSync(`${root}/supabase/migrations/${p}`, 'utf8'));
const db = new PGlite(); // In-memory only. No socket, URL, or credentials.
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({name, status:'PASS'}); console.log('PASS', name); }
  catch(e) { results.push({name, status:'FAIL', error:e.message}); console.log('FAIL', name, e.message); }
}
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function asRole(role, user, statement, params=[]) {
  assert(['anon','authenticated'].includes(role));
  await db.exec('BEGIN');
  try {
    await db.exec(`SET LOCAL ROLE ${role}`);
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [user || '']);
    const identity = (await db.query('SELECT current_user AS role, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.equal(identity.role, role); assert.equal(identity.rolsuper, false); assert.equal(identity.rolbypassrls, false);
    return await db.query(statement, params);
  } finally { await db.exec('ROLLBACK'); }
}
async function denied(role, user, statement, params=[], code='42501') {
  let error;
  try { await asRole(role,user,statement,params); } catch(e) { error=e; }
  assert.ok(error, 'Statement unexpectedly succeeded');
  assert.equal(error.code, code, error.message);
  return error;
}
const insert = 'INSERT INTO public.session_results(session_id,user_id,intervention_type,craving_before,craving_after,stress_before,stress_after) VALUES ($1,$2,$3,8,3,7,2)';
const values = (user, type='craving_reset') => [uid(999),user,type];
try {
  await db.exec(`
    CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon,authenticated;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon,authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
    CREATE TABLE public.session_results(
      session_id uuid PRIMARY KEY, created_at timestamptz DEFAULT now(),
      intervention_type text NULL, craving_before integer, craving_after integer,
      stress_before integer, stress_after integer, stress_level integer,
      mood text, source text, device_id text, client_completed_at timestamptz);
    ALTER TABLE public.session_results ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow anon inserts" ON public.session_results FOR INSERT TO anon WITH CHECK(true);
  `);
  await db.exec(sql[0]); await db.exec(sql[1]);
  for (let n=1;n<=5;n++) await db.query('INSERT INTO auth.users VALUES ($1)',[uid(n)]);
  await db.exec(`INSERT INTO public.consumer_accounts(user_id,entitlement_status,trial_started_at,trial_ends_at) VALUES
    ('${uid(1)}','trial',now()-interval '1 day',now()+interval '6 days'),
    ('${uid(2)}','subscribed',null,null),
    ('${uid(3)}','trial',now()-interval '8 days',now()-interval '1 day'),
    ('${uid(4)}','revoked',null,null);
    INSERT INTO public.session_results(session_id,user_id,intervention_type,craving_before,craving_after)
    VALUES ('${uid(101)}','${uid(1)}','craving_reset',8,3),
           ('${uid(102)}','${uid(3)}','craving_reset',7,4),
           ('${uid(103)}',null,null,6,2);`);
  await test('fixture matches separate roles, direct grants and enabled RLS',async()=>{
    const r=(await db.query("SELECT pg_has_role('authenticated','anon','MEMBER') AS a,pg_has_role('anon','authenticated','MEMBER') AS b,has_table_privilege('anon','public.session_results','INSERT') AS ai,has_table_privilege('authenticated','public.session_results','INSERT') AS ui,relrowsecurity AS rls FROM pg_class WHERE oid='public.session_results'::regclass")).rows[0];
    assert.deepEqual(r,{a:false,b:false,ai:true,ui:true,rls:true});
  });
  await test('baseline permissive policy allows anonymous insertion',()=>asRole('anon',null,insert,values(null)));
  await test('exact prepared security migration applies',()=>db.exec(sql[2]));
  await test('anon direct INSERT removed; authenticated retained',async()=>{
    const r=(await db.query("SELECT has_table_privilege('anon','public.session_results','INSERT') AS a,has_table_privilege('authenticated','public.session_results','INSERT') AS b")).rows[0];
    assert.deepEqual(r,{a:false,b:true});
  });
  for(const type of ['craving_reset','acupressure_reset','grounding_reset']) {
    await test(`${type}: anon null owner rejected`,()=>denied('anon',null,insert,values(null,type)));
    await test(`${type}: anon forged owner rejected`,()=>denied('anon',null,insert,values(uid(1),type)));
    await test(`${type}: active trial own insert accepted`,()=>asRole('authenticated',uid(1),insert,values(uid(1),type)));
    await test(`${type}: subscriber own insert accepted`,()=>asRole('authenticated',uid(2),insert,values(uid(2),type)));
  }
  await test('cross-account authenticated insert rejected',()=>denied('authenticated',uid(1),insert,values(uid(2))));
  await test('authenticated NULL owner rejected',()=>denied('authenticated',uid(1),insert,values(null)));
  await test('authenticated role without simulated subject rejected',()=>denied('authenticated',null,insert,values(uid(1))));
  for(const [n,name] of [[3,'expired trial'],[4,'revoked entitlement'],[5,'missing account']])
    await test(`${name} insert rejected`,()=>denied('authenticated',uid(n),insert,values(uid(n))));
  await test('trial initialization uses actual repository function and remains usable',async()=>{
    await asRole('authenticated',uid(5),'SELECT public.ensure_consumer_account()');
    await denied('anon',null,'SELECT public.ensure_consumer_account()');
  });
  await test('expired trial still reads own historical session only',async()=>{
    const r=await asRole('authenticated',uid(3),'SELECT session_id FROM public.session_results');
    assert.deepEqual(r.rows,[{session_id:uid(102)}]);
  });
  await test('authenticated cannot change own entitlement',()=>denied('authenticated',uid(3),"UPDATE public.consumer_accounts SET entitlement_status='subscribed' WHERE user_id=$1",[uid(3)]));
  await test('restrictive RLS denies residual column INSERT grant',async()=>{
    await db.exec('GRANT INSERT(session_id,user_id,intervention_type) ON public.session_results TO anon');
    try { const e=await denied('anon',null,'INSERT INTO public.session_results(session_id,user_id,intervention_type) VALUES ($1,$2,$3)',values(uid(1))); assert.match(e.message,/row-level security/); }
    finally { await db.exec('REVOKE INSERT(session_id,user_id,intervention_type) ON public.session_results FROM anon'); }
  });
  await test('restrictive RLS denies PUBLIC INSERT grant',async()=>{
    await db.exec('GRANT INSERT ON public.session_results TO PUBLIC');
    try { const e=await denied('anon',null,insert,values(null)); assert.match(e.message,/row-level security/); }
    finally { await db.exec('REVOKE INSERT ON public.session_results FROM PUBLIC'); }
  });
  await test('exact prepared metadata migration applies after security',()=>db.exec(sql[3]));
  await test('historical rows unchanged and metadata NULL',async()=>{
    const rows=(await db.query('SELECT session_id,craving_before,craving_after,active_duration_seconds,guided_sequence_completed FROM public.session_results ORDER BY session_id')).rows;
    assert.equal(rows.length,3);
    assert.deepEqual(rows.map(r=>[r.craving_before,r.craving_after]),[[8,3],[7,4],[6,2]]);
    for(const r of rows) { assert.equal(r.active_duration_seconds,null);assert.equal(r.guided_sequence_completed,null); }
  });
  const metadataInsert='INSERT INTO public.session_results(session_id,user_id,intervention_type,active_duration_seconds,guided_sequence_completed) VALUES ($1,$2,$3,$4::numeric,$5) RETURNING active_duration_seconds::text AS duration,guided_sequence_completed AS completed';
  for(const [duration,completed] of [[null,null],['0',false],['12.25',false],['120',true]]) {
    await test(`metadata roundtrip duration=${duration}, completion=${completed}`,async()=>{
      const r=await asRole('authenticated',uid(1),metadataInsert,[...values(uid(1),'acupressure_reset'),duration,completed]);
      assert.deepEqual(r.rows,[{duration,completed}]);
    });
  }
  for(const duration of ['-1','NaN','Infinity','-Infinity'])
    await test(`duration ${duration} rejected by CHECK`,()=>denied('authenticated',uid(1),metadataInsert,[...values(uid(1)),duration,false],'23514'));
  await test('old client omitting metadata still inserts with NULL fields',async()=>{
    const r=await asRole('authenticated',uid(2),insert+' RETURNING active_duration_seconds,guided_sequence_completed',values(uid(2)));
    assert.deepEqual(r.rows,[{active_duration_seconds:null,guided_sequence_completed:null}]);
  });
  await test('anonymous metadata insert rejected',()=>denied('anon',null,metadataInsert,[...values(null),0,false]));
  await test('authenticated cross-owner metadata insert rejected',()=>denied('authenticated',uid(1),metadataInsert,[...values(uid(2)),0,false]));
  await test('separate authenticated contexts retrieve persistent zero/false',async()=>{
    await db.exec('BEGIN; SET LOCAL ROLE authenticated');
    try {
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[uid(1)]);
      await db.query(metadataInsert,[...values(uid(1),'acupressure_reset'),0,false]);
      await db.exec('COMMIT; RESET ROLE');
    } catch(e) { await db.exec('ROLLBACK; RESET ROLE'); throw e; }
    const own=await asRole('authenticated',uid(1),'SELECT active_duration_seconds::text AS duration,guided_sequence_completed AS completed FROM public.session_results WHERE session_id=$1',[uid(999)]);
    assert.deepEqual(own.rows,[{duration:'0',completed:false}]);
    const other=await asRole('authenticated',uid(2),'SELECT session_id FROM public.session_results WHERE session_id=$1',[uid(999)]);
    assert.equal(other.rows.length,0);
  });
  await test('security rollback restores prior anon behavior only in fixture',async()=>{
    await db.exec('BEGIN; DROP POLICY session_results_deny_anon_insert ON public.session_results; GRANT INSERT ON public.session_results TO anon; COMMIT;');
    await asRole('anon',null,insert,[uid(998),null,'craving_reset']);
  });
  await test('security can be reapplied and anon rejected again',async()=>{
    await db.exec(sql[2]); await denied('anon',null,insert,[uid(998),null,'craving_reset']);
  });
  const version=(await db.query('SELECT version()')).rows[0].version;
  const report={ version, pglite: JSON.parse(readFileSync(resolve(runtimeDir,'node_modules/@electric-sql/pglite/package.json'))).version, migrations:paths.map((p,i)=>({file:p,sha256:createHash('sha256').update(sql[i]).digest('hex')})), results, passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,limitations:['auth.uid() reads a synthetic session setting, not a verified JWT','SET LOCAL ROLE enforces real PostgreSQL privileges/RLS but does not test Supabase HTTP authentication','Base session_results schema reconstructed from known fields; production-only objects not copied','No PostgREST schema cache, token refresh, Stripe event delivery, concurrency or production migration locking tested']};
  writeFileSync(resolve(runtimeDir,'results.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({version,passed:report.passed,failed:report.failed}));
  if(report.failed)process.exitCode=1;
} finally { await db.close(); }
