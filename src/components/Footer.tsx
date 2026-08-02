import { InstagramIcon } from './icons';

export default function Footer() {
  return (
    <footer className="bg-primary pinstripes text-on-primary/75 mt-12">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col items-center gap-3">
        <a
          href="https://www.instagram.com/lapapeinliga"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-on-primary transition-colors"
          aria-label="Instagram"
        >
          <InstagramIcon />
        </a>
        <p className="text-xs">
          Hecho con 💙
        </p>
        <div className="flex gap-4 text-xs">
          <a href="/privacy/" className="hover:text-on-primary transition-colors underline">
            Política de Privacidad
          </a>
          <a href="/terms/" className="hover:text-on-primary transition-colors underline">
            Términos de Servicio
          </a>
        </div>
      </div>
    </footer>
  );
}
