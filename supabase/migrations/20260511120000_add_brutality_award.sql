-- Add 'brutality' to the award_type CHECK constraints on both award tables.
-- Postgres requires dropping and re-adding constraints to modify them.

ALTER TABLE event_award_votes
  DROP CONSTRAINT event_award_votes_award_type_check,
  ADD CONSTRAINT event_award_votes_award_type_check
    CHECK (award_type IN ('top_scorer','best_defense','mvp','best_goalie','most_effort','brutality'));

ALTER TABLE event_award_resolutions
  DROP CONSTRAINT event_award_resolutions_award_type_check,
  ADD CONSTRAINT event_award_resolutions_award_type_check
    CHECK (award_type IN ('top_scorer','best_defense','mvp','best_goalie','most_effort','brutality'));
