#!/usr/bin/env bash
# =============================================================================
# Anonymous security probe.
#
# Hits the live Supabase REST API as the public `anon` role and asserts that
# sensitive columns/tables are NOT readable, and that the intended public
# surface still is. Catches the class of leak the Supabase linter misses:
# a permissive RLS policy combined with broad default grants exposing columns
# that were assumed private (see migration 20260622140000).
#
# Usage:  npm run db:security-check   (or: bash scripts/security-probe.sh)
# Exit 0 if every assertion passes, 1 otherwise.
# =============================================================================
set -uo pipefail

CONFIG="$(dirname "$0")/../src/config.ts"
URL="$(grep -oE 'https://[a-z0-9]+\.supabase\.co' "$CONFIG" | head -1)"
KEY="$(grep -oE 'eyJ[A-Za-z0-9_.-]+' "$CONFIG" | head -1)"

if [[ -z "$URL" || -z "$KEY" ]]; then
  echo "FAIL: could not read SUPABASE_URL / SUPABASE_ANON_KEY from $CONFIG" >&2
  exit 1
fi

fails=0

# Fetch a REST endpoint as anon; echoes "<http_code> <body>".
fetch () {
  curl -s -w $'\n%{http_code}' "$URL/rest/v1/$1" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
}

# Assert an endpoint is PROTECTED: must return an empty array or an HTTP error.
assert_protected () {
  local desc="$1" path="$2" resp code body
  resp="$(fetch "$path")"
  code="${resp##*$'\n'}"; body="${resp%$'\n'*}"
  body="$(echo "$body" | tr -d '[:space:]')"
  if [[ "$body" == "[]" || "$code" -ge 400 ]]; then
    echo "  PASS  $desc"
  else
    echo "  FAIL  $desc  (HTTP $code) -> ${body:0:120}"
    fails=$((fails + 1))
  fi
}

# Assert an endpoint is PUBLIC: must return a non-empty 200 array.
assert_public () {
  local desc="$1" path="$2" resp code body
  resp="$(fetch "$path")"
  code="${resp##*$'\n'}"; body="${resp%$'\n'*}"
  body="$(echo "$body" | tr -d '[:space:]')"
  if [[ "$code" == "200" && "$body" == \[* && "$body" != "[]" ]]; then
    echo "  PASS  $desc"
  else
    echo "  FAIL  $desc  (HTTP $code) -> ${body:0:120}"
    fails=$((fails + 1))
  fi
}

# Assert a PUBLIC endpoint exposes EXACTLY the given columns (an allowlist:
# fails if any column is ever added OR removed). $3 is the expected column set,
# alphabetically sorted and comma-joined. Fail-closed: a future sensitive
# column added here trips the test instead of silently leaking.
assert_exact_columns () {
  local desc="$1" path="$2" expected="$3" resp code body got
  resp="$(fetch "$path")"
  code="${resp##*$'\n'}"; body="${resp%$'\n'*}"
  got="$(printf '%s' "$body" | jq -r 'if type=="array" and length>0 then (.[0]|keys|join(",")) else "__none__" end' 2>/dev/null)"
  if [[ "$code" == "200" && "$got" == "$expected" ]]; then
    echo "  PASS  $desc exposes exactly: $expected"
  else
    echo "  FAIL  $desc  (HTTP $code) columns=[$got] expected=[$expected]"
    fails=$((fails + 1))
  fi
}

echo "Probing $URL as anon..."
echo "Sensitive player columns must NOT be readable:"
assert_protected "players.email"           "players?select=email&limit=1"
assert_protected "players.rating"          "players?select=rating&limit=1"
assert_protected "players.role"            "players?select=role&limit=1"
assert_protected "players.claim_token"     "players?select=claim_token&limit=1"
assert_protected "players.* (all columns)" "players?select=*&limit=1"

echo "RLS-locked tables must NOT be readable:"
assert_protected "player_preferences"      "player_preferences?select=*&limit=1"
assert_protected "event_award_votes"       "event_award_votes?select=*&limit=1"
assert_protected "event_award_resolutions" "event_award_resolutions?select=*&limit=1"
assert_protected "event_feedback"          "event_feedback?select=*&limit=1"
assert_protected "award_types"             "award_types?select=*&limit=1"

echo "Event financial data must NOT be readable (moved off public events):"
assert_protected "event_finances"          "event_finances?select=*&limit=1"
assert_protected "events.cost (removed)"   "events?select=cost&limit=1"
assert_protected "events.payee_alias_cbu"  "events?select=payee_alias_cbu&limit=1"

echo "Public roster view must expose EXACTLY its safe columns (it is SECURITY"
echo "DEFINER, so it bypasses RLS — any column added to it would leak silently):"
assert_exact_columns "players_public" "players_public?select=*&limit=1" "gender,id,name,tier"

echo
if [[ "$fails" -eq 0 ]]; then
  echo "OK: all security probes passed."
  exit 0
else
  echo "SECURITY PROBE FAILED: $fails assertion(s) exposed data that should be private." >&2
  exit 1
fi
