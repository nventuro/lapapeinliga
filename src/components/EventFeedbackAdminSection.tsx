interface EventFeedbackAdminSectionProps {
  bodies: string[] | null;
  loading: boolean;
}

export default function EventFeedbackAdminSection({ bodies, loading }: EventFeedbackAdminSectionProps) {
  if (bodies == null) return null;

  return (
    <div className="border border-border rounded-lg p-4 mt-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-bold text-lg">Comentarios anónimos</h3>
        {bodies.length > 0 && (
          <span className="text-xs text-muted">
            {bodies.length === 1 ? '1 comentario' : `${bodies.length} comentarios`}
          </span>
        )}
      </div>
      {loading ? (
        <p className="text-sm text-muted">Cargando...</p>
      ) : bodies.length === 0 ? (
        <p className="text-sm text-muted italic">Nadie dejó comentarios.</p>
      ) : (
        <div className="space-y-2">
          {bodies.map((body, i) => (
            <div key={i} className="border border-border-subtle rounded-lg p-3 bg-surface text-sm whitespace-pre-wrap">
              {body}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
