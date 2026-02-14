import { Link } from 'react-router-dom';

export default function NoAccess() {
  return (
    <div className="text-center py-12">
      <p className="text-muted mb-4">No tenés acceso a esta sección.</p>
      <Link to="/" className="text-primary hover:text-primary-hover underline">
        Volver al inicio
      </Link>
    </div>
  );
}
