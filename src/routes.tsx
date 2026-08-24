import type { ComponentType } from 'react';
import EventListPage from './components/EventListPage';
import EventListSkeleton from './components/EventListSkeleton';
import EventDetailPage from './components/EventDetailPage';
import EventDetailSkeleton from './components/EventDetailSkeleton';
import StatsPage from './components/StatsPage';
import StatsSkeleton from './components/StatsSkeleton';
import TeamSorterPage from './components/TeamSorterPage';
import PlantelPage from './components/PlantelPage';
import PlantelSkeleton from './components/PlantelSkeleton';
import PlayerPage from './components/PlayerPage';
import PlayerSkeleton from './components/PlayerSkeleton';
import TrophyListPage from './components/TrophyListPage';
import TrophyListSkeleton from './components/TrophyListSkeleton';
import TrophyDetailPage from './components/TrophyDetailPage';
import TrophyDetailSkeleton from './components/TrophyDetailSkeleton';
import GalleryPage from './components/GalleryPage';
import GallerySkeleton from './components/GallerySkeleton';
import ClaimPage from './components/ClaimPage';

/** Where the bare root sends visitors. */
export const HOME_PATH = '/fechas';

export interface PageRoute {
  /** Relative to the root, in react-router's pattern syntax. */
  path: string;
  Page: ComponentType;
  /** What the page area shows while the app's own data is still loading.
   *  Null for pages too rarely landed on cold to be worth drawing. */
  Skeleton: ComponentType | null;
}

/** Every page in the app, with the placeholder that stands in for it. */
export const PAGE_ROUTES: PageRoute[] = [
  { path: 'fechas', Page: EventListPage, Skeleton: EventListSkeleton },
  { path: 'fechas/:id', Page: EventDetailPage, Skeleton: EventDetailSkeleton },
  { path: 'estadisticas', Page: StatsPage, Skeleton: StatsSkeleton },
  { path: 'armado', Page: TeamSorterPage, Skeleton: null },
  { path: 'plantel', Page: PlantelPage, Skeleton: PlantelSkeleton },
  { path: 'plantel/:id', Page: PlayerPage, Skeleton: PlayerSkeleton },
  { path: 'trofeos', Page: TrophyListPage, Skeleton: TrophyListSkeleton },
  { path: 'trofeos/:id', Page: TrophyDetailPage, Skeleton: TrophyDetailSkeleton },
  { path: 'galeria', Page: GalleryPage, Skeleton: GallerySkeleton },
  { path: 'vincular', Page: ClaimPage, Skeleton: null },
];
