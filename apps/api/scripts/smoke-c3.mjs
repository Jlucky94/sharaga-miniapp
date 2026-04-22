// CHECK-C3 live smoke against running API on port 3001.
// node apps/api/scripts/smoke-c3.mjs

const API = 'http://127.0.0.1:3001/api/v1';

const ALICE_INIT = 'auth_date=1776846928&query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A81001%2C%22first_name%22%3A%22Alice%22%2C%22username%22%3A%22alice81001%22%7D&hash=1973e979feae29eb05051515d5be076075579d39aa757964d84a8eada902026c';
const BOB_INIT = 'auth_date=1776846930&query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A81002%2C%22first_name%22%3A%22Bob%22%2C%22username%22%3A%22bob81002%22%7D&hash=f7aafe3f361c2a5ef327dd6f346726a3cd13a0d5c2181185efaa1d6e003270cd';
const CORA_INIT = 'auth_date=1776846931&query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A81003%2C%22first_name%22%3A%22Cora%22%2C%22username%22%3A%22cora81003%22%7D&hash=a15e617fe1825e38fb6ed528bda19a90088de03a9c44e8afb2e3707fd9f08901';

const ok = (msg) => console.log(`  ✅ ${msg}`);
const fail = (msg) => { console.error(`  ❌ ${msg}`); process.exit(1); };

async function post(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) fail(`POST ${path} -> ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function get(path, token) {
  const res = await fetch(`${API}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const json = await res.json();
  if (!res.ok) fail(`GET ${path} -> ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function postRaw(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function auth(initData, archetype) {
  const { accessToken } = await post('/auth/telegram', { initData });
  const sel = await postRaw('/class/select', { archetype }, accessToken);
  if (sel.status !== 200 && sel.status !== 409) fail(`/class/select -> ${sel.status}: ${JSON.stringify(sel.body)}`);
  return accessToken;
}

console.log('\n=== CHECK-C3 live smoke ===\n');

// Step 1: Auth
console.log('1. Auth + archetype select');
const tokA = await auth(ALICE_INIT, 'botan');
const tokB = await auth(BOB_INIT, 'sportsman');
const tokC = await auth(CORA_INIT, 'partygoer');
ok('Alice(botan), Bob(sportsman), Cora(partygoer) authenticated');

// Step 2: Queue
console.log('2. Queue for Exam (capacity=3)');
const queueA = await post('/parties/queue', { capacity: 3 }, tokA);
const partyId = queueA.party?.id;
if (!partyId) fail(`Alice queue failed – no partyId: ${JSON.stringify(queueA)}`);
ok(`Alice queued -> party ${partyId} (status: ${queueA.party.status})`);

await post('/parties/queue', { capacity: 3 }, tokB);
ok('Bob queued');

const queueC = await post('/parties/queue', { capacity: 3 }, tokC);
if (queueC.party?.status !== 'ready_check') fail(`After Cora, party should be ready_check, got: ${queueC.party?.status}`);
ok(`Cora queued -> party flipped to ready_check ✓`);

// Step 3: Ready check
console.log('3. Ready check');
const readyA = await post(`/parties/${partyId}/ready`, { ready: true }, tokA);
if (readyA.run !== null) fail('ready(Alice) should not autostart yet');
ok('Alice ready (no autostart yet)');

const readyB = await post(`/parties/${partyId}/ready`, { ready: true }, tokB);
if (readyB.run !== null) fail('ready(Bob) should not autostart yet');
ok('Bob ready (no autostart yet)');

const readyC = await post(`/parties/${partyId}/ready`, { ready: true }, tokC);
const runId = readyC.run?.id;
const outcome = readyC.run?.outcome;
const rewardsLen = readyC.run?.rewards?.length;
if (!runId) fail(`Cora final ready should produce a run: ${JSON.stringify(readyC)}`);
if (readyC.party !== null) fail('party should be null in final ready response');
if (!['success', 'partial_failure'].includes(outcome)) fail(`Unexpected outcome: ${outcome}`);
if (rewardsLen !== 3) fail(`Expected 3 rewards, got ${rewardsLen}`);
ok(`Cora final ready -> run ${runId} (outcome: ${outcome}, rewards: ${rewardsLen})`);

// Step 4: Rewards persist
console.log('4. Rewards persist in profile');
const profA = (await get('/profile', tokA)).profile;
const profB = (await get('/profile', tokB)).profile;
const profC = (await get('/profile', tokC)).profile;
if (profA.profileXp <= 0) fail(`Alice profileXp should be > 0, got ${profA.profileXp}`);
if (profB.profileXp <= 0) fail(`Bob profileXp should be > 0, got ${profB.profileXp}`);
if (profC.profileXp <= 0) fail(`Cora profileXp should be > 0, got ${profC.profileXp}`);
ok(`All three profiles show XP > 0 (Alice=${profA.profileXp}, Bob=${profB.profileXp}, Cora=${profC.profileXp})`);

// Step 5: /exam latestRun
console.log('5. /exam latestRun');
const examState = await get('/exam', tokA);
if (examState.latestRun?.partyId !== partyId) fail(`latestRun.partyId mismatch: ${examState.latestRun?.partyId} != ${partyId}`);
ok('/exam latestRun.partyId matches');

// Step 6: Feed visibility
console.log('6. Feed visibility');
const ownerFeed = await get('/feed', tokA);
const memberFeed = await get('/feed', tokB);
// Filter to current run's partyId — DB may have prior exam_results from earlier smoke runs with same user IDs.
const ownerExamItems = ownerFeed.items.filter((i) => i.kind === 'exam_result' && i.partyId === partyId);
const memberExamItems = memberFeed.items.filter((i) => i.kind === 'exam_result' && i.partyId === partyId);
if (ownerExamItems.length !== 1) fail(`Owner feed: expected 1 exam_result for party ${partyId}, got ${ownerExamItems.length}`);
if (memberExamItems.length !== 1) fail(`Non-owner feed: expected 1 exam_result for party ${partyId}, got ${memberExamItems.length}`);
ok('Owner feed: 1 exam_result for current partyId ✓');
ok('Non-owner (Bob) feed: 1 exam_result for current partyId ✓');

// Step 7: Idempotency
console.log('7. Idempotency: replay final ready');
const replay = await post(`/parties/${partyId}/ready`, { ready: true }, tokC);
if (replay.run?.id !== runId) fail(`Replay run.id changed: ${replay.run?.id} != ${runId}`);
if (replay.party !== null) fail('Replay should return party=null');
ok(`Replay returns same run.id=${runId}`);

const profA2 = (await get('/profile', tokA)).profile;
const profB2 = (await get('/profile', tokB)).profile;
if (profA2.profileXp !== profA.profileXp) fail(`Alice XP changed after replay: ${profA.profileXp} -> ${profA2.profileXp}`);
if (profB2.profileXp !== profB.profileXp) fail(`Bob XP changed after replay: ${profB.profileXp} -> ${profB2.profileXp}`);
ok('Profiles unchanged after replay');

const memberFeed2 = await get('/feed', tokB);
const memberExamCount2 = memberFeed2.items.filter((i) => i.kind === 'exam_result' && i.partyId === partyId).length;
if (memberExamCount2 !== 1) fail(`Feed duplicated after replay: ${memberExamCount2} exam_result items for party ${partyId}`);
ok('Feed still shows exactly 1 exam_result after replay');

console.log('\n=== All CHECK-C3 smoke points PASSED ===\n');
console.log(`  Outcome:    ${outcome}`);
console.log(`  Party ID:   ${partyId}`);
console.log(`  Run ID:     ${runId}`);
console.log(`  XP (A/B/C): ${profA.profileXp} / ${profB.profileXp} / ${profC.profileXp}`);
console.log('');
