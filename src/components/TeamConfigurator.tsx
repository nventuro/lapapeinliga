interface TeamConfiguratorProps {
  teamCount: number;
  onTeamCountChange: (count: number) => void;
  selectedCount: number;
  onGenerate: () => void;
}

export default function TeamConfigurator({
  teamCount,
  onTeamCountChange,
  selectedCount,
  onGenerate,
}: TeamConfiguratorProps) {
  const canGenerate = selectedCount >= teamCount && teamCount >= 2;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Armar equipos</h2>

      <div className="flex items-center gap-4 mb-4">
        <label className="font-medium">Cantidad de equipos:</label>
        <input
          type="number"
          min={2}
          max={Math.max(2, selectedCount)}
          value={teamCount}
          onChange={(e) => onTeamCountChange(Number(e.target.value))}
          className="w-20 px-3 py-2 border border-border rounded text-center"
        />
      </div>

      <p className="text-sm text-muted mb-4">
        {selectedCount} jugadores seleccionados → ~{Math.floor(selectedCount / teamCount)} por equipo
      </p>

      <button
        onClick={onGenerate}
        disabled={!canGenerate}
        className="w-full py-3 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-colors"
      >
        ¡Armar equipos!
      </button>

      {!canGenerate && selectedCount < teamCount && (
        <p className="text-sm text-error mt-2">
          Necesitás al menos {teamCount} jugadores para armar {teamCount} equipos.
        </p>
      )}
    </div>
  );
}
