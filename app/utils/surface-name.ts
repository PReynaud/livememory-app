export const surfaceNameForRoute = (path: string, eventName?: string | null): string => {
  if (path === '/home' || path.startsWith('/home/')) {
    return 'Home';
  }

  if (path === '/concerts' || path.startsWith('/concerts/')) {
    return 'Concerts';
  }

  if (path === '/profile' || path.startsWith('/profile/')) {
    return 'Profile';
  }

  if (path.startsWith('/e/')) {
    const name = (eventName ?? '').trim();
    return name ? `Event: ${name}` : '';
  }

  if (path.startsWith('/u/')) {
    const handle = path.slice(3).split('/').filter(Boolean)[0] ?? '';
    return handle ? `Shared list for ${handle}` : '';
  }

  return '';
};
