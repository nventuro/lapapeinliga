import {
  IconCalendarEvent,
  IconClipboardList,
  IconUsersGroup,
  IconLock,
  IconLockOpen,
  IconTrophy,
  IconBallFootball,
  IconShield,
  IconCrown,
  IconHandStop,
  IconEgg,
  IconPencil,
  IconTrash,
  IconChartBar,
  IconShoe,
  IconSettings,
  IconMedal2,
  IconBrandInstagram,
  IconGenderMale,
  IconGenderFemale,
  IconShirtFilled,
  IconBrandWhatsapp,
  IconArrowsShuffle,
  IconCone,
  IconBarbell,
} from '@tabler/icons-react';

interface IconProps {
  className?: string;
}

const STROKE = 1.5;

export function CalendarIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconCalendarEvent className={className} stroke={STROKE} />;
}

export function ClipboardIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconClipboardList className={className} stroke={STROKE} />;
}

export function UserGroupIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconUsersGroup className={className} stroke={STROKE} />;
}

export function LockedIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconLock className={className} stroke={STROKE} />;
}

export function UnlockedIcon({ className = 'w-4 h-4 opacity-30' }: IconProps) {
  return <IconLockOpen className={className} stroke={STROKE} />;
}

export function TrophyIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconTrophy className={className} stroke={STROKE} />;
}

export function SoccerBallIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconBallFootball className={className} stroke={STROKE} />;
}

export function ShieldIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconShield className={className} stroke={STROKE} />;
}

export function CrownIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconCrown className={className} stroke={STROKE} />;
}

export function GloveIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconHandStop className={className} stroke={STROKE} />;
}

export function EggIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconEgg className={className} stroke={STROKE} />;
}

export function EditIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconPencil className={className} stroke={STROKE} />;
}

export function TrashIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconTrash className={className} stroke={STROKE} />;
}

export function ChartBarIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconChartBar className={className} stroke={STROKE} />;
}

export function SneakerIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconShoe className={className} stroke={STROKE} />;
}

export function CogIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconSettings className={className} stroke={STROKE} />;
}

export function MedalIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconMedal2 className={className} stroke={STROKE} />;
}

export function InstagramIcon({ className = 'w-7 h-7' }: IconProps) {
  return <IconBrandInstagram className={className} stroke={STROKE} />;
}

export function GenderMaleIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconGenderMale className={`text-gender-male ${className}`} stroke={STROKE} />;
}

export function GenderFemaleIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconGenderFemale className={`text-gender-female ${className}`} stroke={STROKE} />;
}

export function ShirtIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconShirtFilled className={className} />;
}

export function WhatsAppIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconBrandWhatsapp className={className} stroke={STROKE} />;
}

export function ShuffleIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconArrowsShuffle className={className} stroke={STROKE} />;
}

export function ConeIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconCone className={className} stroke={STROKE} />;
}

export function BarbellIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconBarbell className={className} stroke={STROKE} />;
}

// Official Google "G" logo — paths from Firebase Auth UI (Copyright 2016 Google Inc.)
export function GoogleIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 120 120">
      <path d="M117.6 61.364C117.6 57.109 117.218 53.018 116.51 49.091H60v23.209h32.291c-1.39 7.5-5.618 13.855-11.973 18.109v15.054h19.391C111.055 95.018 117.6 79.636 117.6 61.364z" fill="#4285F4" />
      <path d="M60 120c16.2 0 29.782-5.373 39.71-14.536L80.317 90.409C74.945 94.01 68.073 96.136 60 96.136c-15.627 0-28.855-10.554-33.573-24.736H6.382v15.545C16.255 106.555 36.545 120 60 120z" fill="#34A853" />
      <path d="M26.427 71.4c-1.2-3.6-1.882-7.445-1.882-11.4s.682-7.8 1.882-11.4V33.055H6.382A59.876 59.876 0 0 0 0 60c0 9.682 2.318 18.845 6.382 26.945L26.427 71.4z" fill="#FBBC05" />
      <path d="M60 23.864c8.81 0 16.718 3.027 22.936 8.973l17.21-17.21C89.754 5.946 76.172 0 60 0 36.545 0 16.255 13.445 6.382 33.055L26.427 48.6C31.145 34.418 44.373 23.864 60 23.864z" fill="#EA4335" />
    </svg>
  );
}
