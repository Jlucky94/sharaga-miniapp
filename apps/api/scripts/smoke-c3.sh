#!/usr/bin/env bash
# CHECK-C3 live smoke against running API on port 3001.
# Usage: bash apps/api/scripts/smoke-c3.sh
set -e

API="http://127.0.0.1:3001/api/v1"

ALICE_INIT="auth_date=1776846928&query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A81001%2C%22first_name%22%3A%22Alice%22%2C%22username%22%3A%22alice81001%22%7D&hash=1973e979feae29eb05051515d5be076075579d39aa757964d84a8eada902026c"
BOB_INIT="auth_date=1776846930&query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A81002%2C%22first_name%22%3A%22Bob%22%2C%22username%22%3A%22bob81002%22%7D&hash=f7aafe3f361c2a5ef327dd6f346726a3cd13a0d5c2181185efaa1d6e003270cd"
CORA_INIT="auth_date=1776846931&query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A81003%2C%22first_name%22%3A%22Cora%22%2C%22username%22%3A%22cora81003%22%7D&hash=a15e617fe1825e38fb6ed528bda19a90088de03a9c44e8afb2e3707fd9f08901"

ok() { echo "  ✅ $1"; }
fail() { echo "  ❌ $1"; exit 1; }

echo ""
echo "=== CHECK-C3 live smoke ==="
echo ""

# ── Step 1: Auth + archetype select ──────────────────────────────────────────
echo "1. Auth + archetype select"

auth() {
  local initData="$1" archetype="$2"
  local token
  token=$(curl -sf -X POST "$API/auth/telegram" \
    -H "Content-Type: application/json" \
    -d "{\"initData\":\"$initData\"}" | jq -r '.accessToken')
  curl -sf -X POST "$API/class/select" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "{\"archetype\":\"$archetype\"}" > /dev/null
  echo "$token"
}

TOK_A=$(auth "$ALICE_INIT" "botan")
TOK_B=$(auth "$BOB_INIT" "sportsman")
TOK_C=$(auth "$CORA_INIT" "partygoer")
ok "Alice(botan), Bob(sportsman), Cora(partygoer) authenticated"

# ── Step 2: Queue all three (capacity=3) ─────────────────────────────────────
echo "2. Queue for Exam (capacity=3)"

QUEUE_A=$(curl -sf -X POST "$API/parties/queue" \
  -H "Authorization: Bearer $TOK_A" \
  -H "Content-Type: application/json" \
  -d '{"capacity":3}')
PARTY_ID=$(echo "$QUEUE_A" | jq -r '.party.id')
PARTY_STATUS=$(echo "$QUEUE_A" | jq -r '.party.status')
[ "$PARTY_ID" != "null" ] && [ -n "$PARTY_ID" ] || fail "Alice queue failed - no partyId"
ok "Alice queued -> party $PARTY_ID (status: $PARTY_STATUS)"

curl -sf -X POST "$API/parties/queue" \
  -H "Authorization: Bearer $TOK_B" \
  -H "Content-Type: application/json" \
  -d '{"capacity":3}' > /dev/null
ok "Bob queued"

QUEUE_C=$(curl -sf -X POST "$API/parties/queue" \
  -H "Authorization: Bearer $TOK_C" \
  -H "Content-Type: application/json" \
  -d '{"capacity":3}')
PARTY_STATUS_C=$(echo "$QUEUE_C" | jq -r '.party.status')
[ "$PARTY_STATUS_C" = "ready_check" ] || fail "After Cora joins, party should be ready_check, got: $PARTY_STATUS_C"
ok "Cora queued -> party flipped to ready_check ✓"

# ── Step 3: Ready check ───────────────────────────────────────────────────────
echo "3. Ready check"

READY_A=$(curl -sf -X POST "$API/parties/$PARTY_ID/ready" \
  -H "Authorization: Bearer $TOK_A" \
  -H "Content-Type: application/json" \
  -d '{"ready":true}')
RUN_A=$(echo "$READY_A" | jq -r '.run')
[ "$RUN_A" = "null" ] || fail "Ready(Alice) should not start run yet"
ok "Alice ready (no autostart yet)"

READY_B=$(curl -sf -X POST "$API/parties/$PARTY_ID/ready" \
  -H "Authorization: Bearer $TOK_B" \
  -H "Content-Type: application/json" \
  -d '{"ready":true}')
RUN_B=$(echo "$READY_B" | jq -r '.run')
[ "$RUN_B" = "null" ] || fail "Ready(Bob) should not start run yet"
ok "Bob ready (no autostart yet)"

READY_C=$(curl -sf -X POST "$API/parties/$PARTY_ID/ready" \
  -H "Authorization: Bearer $TOK_C" \
  -H "Content-Type: application/json" \
  -d '{"ready":true}')
RUN_ID=$(echo "$READY_C" | jq -r '.run.id')
OUTCOME=$(echo "$READY_C" | jq -r '.run.outcome')
REWARDS_LEN=$(echo "$READY_C" | jq '.run.rewards | length')
PARTY_AFTER=$(echo "$READY_C" | jq -r '.party')

[ "$RUN_ID" != "null" ] && [ -n "$RUN_ID" ] || fail "Cora final ready should produce a run"
[ "$PARTY_AFTER" = "null" ] || fail "party should be null in final ready response"
[[ "$OUTCOME" == "success" || "$OUTCOME" == "partial_failure" ]] || fail "Unexpected outcome: $OUTCOME"
[ "$REWARDS_LEN" -eq 3 ] || fail "Expected 3 rewards, got $REWARDS_LEN"
ok "Cora final ready -> run $RUN_ID (outcome: $OUTCOME, rewards: $REWARDS_LEN)"

# ── Step 4: Rewards persist in profile ───────────────────────────────────────
echo "4. Rewards persist in profile"

XP_A=$(curl -sf "$API/profile" -H "Authorization: Bearer $TOK_A" | jq '.profile.profileXp')
XP_B=$(curl -sf "$API/profile" -H "Authorization: Bearer $TOK_B" | jq '.profile.profileXp')
XP_C=$(curl -sf "$API/profile" -H "Authorization: Bearer $TOK_C" | jq '.profile.profileXp')
[ "$XP_A" -gt 0 ] || fail "Alice profileXp should be > 0 after exam"
[ "$XP_B" -gt 0 ] || fail "Bob profileXp should be > 0 after exam"
[ "$XP_C" -gt 0 ] || fail "Cora profileXp should be > 0 after exam"
ok "All three profiles show XP > 0 (Alice=$XP_A, Bob=$XP_B, Cora=$XP_C)"

# ── Step 5: /exam returns latestRun ──────────────────────────────────────────
echo "5. /exam latestRun"

EXAM_STATE=$(curl -sf "$API/exam" -H "Authorization: Bearer $TOK_A")
LATEST_RUN_PARTY=$(echo "$EXAM_STATE" | jq -r '.latestRun.partyId')
[ "$LATEST_RUN_PARTY" = "$PARTY_ID" ] || fail "latestRun.partyId mismatch: $LATEST_RUN_PARTY != $PARTY_ID"
ok "/exam latestRun.partyId matches"

# ── Step 6: Feed has exactly one exam_result (owner and non-owner) ────────────
echo "6. Feed visibility"

OWNER_FEED=$(curl -sf "$API/feed" -H "Authorization: Bearer $TOK_A")
MEMBER_FEED=$(curl -sf "$API/feed" -H "Authorization: Bearer $TOK_B")

OWNER_EXAM_COUNT=$(echo "$OWNER_FEED" | jq '[.items[] | select(.kind == "exam_result")] | length')
MEMBER_EXAM_COUNT=$(echo "$MEMBER_FEED" | jq '[.items[] | select(.kind == "exam_result")] | length')

[ "$OWNER_EXAM_COUNT" -eq 1 ] || fail "Owner feed: expected 1 exam_result, got $OWNER_EXAM_COUNT"
[ "$MEMBER_EXAM_COUNT" -eq 1 ] || fail "Non-owner feed: expected 1 exam_result, got $MEMBER_EXAM_COUNT"

OWNER_EXAM_PARTY=$(echo "$OWNER_FEED" | jq -r '[.items[] | select(.kind == "exam_result")][0].partyId')
[ "$OWNER_EXAM_PARTY" = "$PARTY_ID" ] || fail "Owner feed exam_result.partyId mismatch"
ok "Owner feed: 1 exam_result ✓"
ok "Non-owner (Bob) feed: 1 exam_result ✓"

# ── Step 7: Idempotency – replay final ready ──────────────────────────────────
echo "7. Idempotency: replay final ready"

REPLAY=$(curl -sf -X POST "$API/parties/$PARTY_ID/ready" \
  -H "Authorization: Bearer $TOK_C" \
  -H "Content-Type: application/json" \
  -d '{"ready":true}')
REPLAY_RUN_ID=$(echo "$REPLAY" | jq -r '.run.id')
REPLAY_PARTY=$(echo "$REPLAY" | jq -r '.party')

[ "$REPLAY_RUN_ID" = "$RUN_ID" ] || fail "Replay run.id changed: $REPLAY_RUN_ID != $RUN_ID"
[ "$REPLAY_PARTY" = "null" ] || fail "Replay should return party=null"
ok "Replay returns same run.id=$RUN_ID"

XP_A2=$(curl -sf "$API/profile" -H "Authorization: Bearer $TOK_A" | jq '.profile.profileXp')
XP_B2=$(curl -sf "$API/profile" -H "Authorization: Bearer $TOK_B" | jq '.profile.profileXp')
[ "$XP_A2" -eq "$XP_A" ] || fail "Alice XP changed after replay: $XP_A -> $XP_A2"
[ "$XP_B2" -eq "$XP_B" ] || fail "Bob XP changed after replay: $XP_B -> $XP_B2"
ok "Profiles unchanged after replay"

MEMBER_FEED2=$(curl -sf "$API/feed" -H "Authorization: Bearer $TOK_B")
MEMBER_EXAM_COUNT2=$(echo "$MEMBER_FEED2" | jq '[.items[] | select(.kind == "exam_result")] | length')
[ "$MEMBER_EXAM_COUNT2" -eq 1 ] || fail "Feed duplicated after replay: $MEMBER_EXAM_COUNT2 exam_result items"
ok "Feed still shows exactly 1 exam_result after replay"

echo ""
echo "=== All CHECK-C3 smoke points PASSED ==="
echo ""
echo "  Outcome:   $OUTCOME"
echo "  Party ID:  $PARTY_ID"
echo "  Run ID:    $RUN_ID"
echo "  XP (A/B/C): $XP_A / $XP_B / $XP_C"
echo ""
