import { InstagramIcon } from './icons';

export default function Footer({ className = '' }: { className?: string }) {
  return (
    <footer className={`flex flex-col items-center gap-3 ${className}`}>
      <a
        href="https://www.instagram.com/lapapeinliga"
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted hover:text-muted-strong transition-colors"
        aria-label="Instagram"
      >
        <InstagramIcon />
      </a>
      <p className="text-xs text-muted">
        Hecho con 💙
      </p>
      <div className="flex gap-4 text-xs text-muted">
        <a href="/privacy/" className="hover:text-muted-strong transition-colors underline">
          Política de Privacidad
        </a>
        <a href="/terms/" className="hover:text-muted-strong transition-colors underline">
          Términos de Servicio
        </a>
      </div>
    </footer>
  );
}
