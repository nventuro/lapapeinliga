-- Knockout games against externals (e.g. a final) can go to a penalty
-- shootout after a tie. The shootout score is stored alongside the match
-- score; the winner stays derived in the app, like win/loss/draw.

ALTER TABLE external_matches
  ADD COLUMN our_penalties integer CHECK (our_penalties IS NULL OR our_penalties >= 0),
  ADD COLUMN their_penalties integer CHECK (their_penalties IS NULL OR their_penalties >= 0),
  ADD CONSTRAINT external_matches_penalties_both_or_neither
    CHECK ((our_penalties IS NULL) = (their_penalties IS NULL)),
  -- A shootout only happens after a tie. our_score = their_score alone would
  -- pass the CHECK when the scores are NULL (NULL result), so the NOT NULL
  -- test is spelled out.
  ADD CONSTRAINT external_matches_penalties_require_tie
    CHECK (our_penalties IS NULL OR (our_score IS NOT NULL AND our_score = their_score)),
  -- A shootout always produces a winner.
  ADD CONSTRAINT external_matches_penalties_have_winner
    CHECK (our_penalties IS NULL OR our_penalties <> their_penalties);
