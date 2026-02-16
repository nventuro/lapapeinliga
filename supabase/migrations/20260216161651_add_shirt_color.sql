alter table matchday_teams
  add column shirt_color text not null default 'light'
  check (shirt_color in ('light', 'dark'));
