export default function GenderIcon({ gender }: { gender: 'male' | 'female' }) {
  return (
    <span className="text-muted text-xl" title={gender === 'male' ? 'Masculino' : 'Femenino'}>
      {gender === 'male' ? '♂' : '♀'}
    </span>
  );
}
