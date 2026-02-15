import ToggleSwitch from './ToggleSwitch';

export default function RatingToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <ToggleSwitch
      checked={show}
      onChange={onToggle}
      label="Mostrar puntajes"
    />
  );
}
