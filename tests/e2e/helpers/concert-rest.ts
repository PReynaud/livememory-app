import { CONCERT_VISIBLE_COLUMNS } from '../../../shared/domain/concerts';

export { CONCERT_VISIBLE_COLUMNS };

export const concertsRest = (supabaseUrl: string, params?: string) => {
  const select = `select=${CONCERT_VISIBLE_COLUMNS}`;
  const query = params ? `${params}&${select}` : select;
  return `${supabaseUrl}/rest/v1/concerts?${query}`;
};

export const concertNotesRest = (supabaseUrl: string, params: string) => {
  return `${supabaseUrl}/rest/v1/concert_notes?${params}&select=concert_id,notes`;
};
