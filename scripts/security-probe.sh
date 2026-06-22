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

echo "Public roster view must expose ONLY safe columns (it is SECURITY DEFINER,"
echo "so it bypasses RLS — a mis-added sensitive column would leak silently):"
assert_protected "players_public.email"    "players_public?select=email&limit=1"
assert_protected "players_public.rating"   "players_public?select=rating&limit=1"
assert_protected "players_public.role"     "players_public?select=role&limit=1"

echo "Public roster must STILL be readable:"
assert_public    "players_public"          "players_public?select=id&limit=1"

echo
if [[ "$fails" -eq 0 ]]; then
  echo "OK: all security probes passed."
  exit 0
else
  echo "SECURITY PROBE FAILED: $fails assertion(s) exposed data that should be private." >&2
  exit 1
fi
