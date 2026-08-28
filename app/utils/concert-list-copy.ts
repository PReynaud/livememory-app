export const CONCERT_LIST_COPY = {
  upcomingTab: 'Coming up',
  pastTab: 'Souvenirs',
  filter: 'Filter',
  apply: 'Apply',
  reset: 'Reset',
  clearAll: 'Clear all',
  loadMore: 'Load more',
  emptyUpcoming: 'Nothing upcoming right now.',
  emptyUpcomingPublic: 'No upcoming concerts on this list.',
  emptyPast: 'No souvenirs yet.',
  emptyFiltered: 'No concerts match your filters.',
  addConcert: 'Add concert',
  filterHintUpcoming: 'Artist, place, Going status…',
  filterHintPast: 'Year, artist, place…',
  filterHintUpcomingPublic: 'Artist, place…',
  thisMonth: 'This month',
  night: 'Night',
  festival: 'Festival',
  going: 'Going',
  attended: 'Attended',
  status: 'Status',
  type: 'Type',
  place: 'Place',
  year: 'Year',
  period: 'Period',
  artist: 'Artist',
  artistPlaceholder: 'Search artists',
  loadingMore: 'Loading more',
  filtersApplied: (count: number) => {
    return count === 1 ? '1 filter applied.' : `${count} filters applied.`;
  },
  criteriaSelected: (count: number) => {
    return count === 1 ? '1 criterion selected' : `${count} criteria selected`;
  },
  removeFilter: (label: string) => `Remove filter ${label}`
} as const;
