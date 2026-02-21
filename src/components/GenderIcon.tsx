import { GenderMaleIcon, GenderFemaleIcon } from './icons';

export default function GenderIcon({ gender }: { gender: 'male' | 'female' }) {
  return gender === 'male' ? (
    <GenderMaleIcon className="w-5 h-5" />
  ) : (
    <GenderFemaleIcon className="w-5 h-5" />
  );
}
