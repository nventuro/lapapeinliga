/**
 * The table plumbing behind a team-structured event type. Matches and
 * tournaments are structurally identical (teams of players + reserves +
 * a winner), differing only in table/column names — this config captures
 * that difference once, so TeamEventSection can render and mutate both.
 */
export interface TeamRosterConfig {
  teamsTable: 'match_teams' | 'tournament_teams';
  teamPlayersTable: 'match_team_players' | 'tournament_team_players';
  teamFkColumn: 'match_team_id' | 'tournament_team_id';
  reservesTable: 'match_reserves' | 'tournament_reserves';
  parentFkColumn: 'match_id' | 'tournament_id';
}

export const MATCH_ROSTER_CONFIG: TeamRosterConfig = {
  teamsTable: 'match_teams',
  teamPlayersTable: 'match_team_players',
  teamFkColumn: 'match_team_id',
  reservesTable: 'match_reserves',
  parentFkColumn: 'match_id',
};

export const TOURNAMENT_ROSTER_CONFIG: TeamRosterConfig = {
  teamsTable: 'tournament_teams',
  teamPlayersTable: 'tournament_team_players',
  teamFkColumn: 'tournament_team_id',
  reservesTable: 'tournament_reserves',
  parentFkColumn: 'tournament_id',
};
