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
  return <IconGenderMale className={className} stroke={STROKE} />;
}

export function GenderFemaleIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconGenderFemale className={className} stroke={STROKE} />;
}

export function ShirtIcon({ className = 'w-4 h-4' }: IconProps) {
  return <IconShirtFilled className={className} />;
}
