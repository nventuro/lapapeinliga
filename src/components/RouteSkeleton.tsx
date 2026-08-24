import { matchPath, useLocation } from 'react-router-dom';
import { HOME_PATH, PAGE_ROUTES } from '../routes';

/** The skeleton of whichever page the current URL leads to. */
export default function RouteSkeleton() {
  const { pathname } = useLocation();
  // The root's redirect only runs once the pages render, so resolve it here.
  const target = pathname === '/' ? HOME_PATH : pathname;
  const PageSkeleton = PAGE_ROUTES.find((route) => matchPath(route.path, target))?.Skeleton;
  return PageSkeleton ? <PageSkeleton /> : null;
}
