import type { TournamentTeam, TournamentMatch } from '../types';
import { computeStandings } from '../utils/tournamentStandings';

interface StandingsTableProps {
  teams: TournamentTeam[];
  matches: TournamentMatch[];
}

export default function StandingsTable({ teams, matches }: StandingsTableProps) {
  const standings = computeStandings(teams, matches);

  return (
    <div className="border border-border rounded-lg p-4 mt-4">
      <h3 className="font-bold text-lg mb-3">Posiciones</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted text-left">
              <th className="pb-2 pr-4">Equipo</th>
              <th className="pb-2 px-2 text-center">Jugados</th>
              <th className="pb-2 px-2 text-center">Resultados</th>
              <th className="pb-2 px-2 text-center">Goles</th>
              <th className="pb-2 pl-2 text-center">Puntos</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => (
              <tr key={s.teamId} className="border-t border-border-subtle">
                <td className="py-2 pr-4 font-medium">{s.teamName}</td>
                <td className="py-2 px-2 text-center">{s.played}</td>
                <td className="py-2 px-2 text-center">
                  <span className="text-success">{s.won}</span>
                  /
                  <span className="text-info">{s.drawn}</span>
                  /
                  <span className="text-error">{s.lost}</span>
                </td>
                <td className="py-2 px-2 text-center">
                  <span className="text-success">{s.goalsFor}</span>
                  /
                  <span className="text-error">{s.goalsAgainst}</span>
                </td>
                <td className="py-2 pl-2 text-center font-bold">{s.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
