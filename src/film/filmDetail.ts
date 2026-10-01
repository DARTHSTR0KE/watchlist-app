import { supabase } from '../lib/supabaseClient'
import { FILM_DETAIL_COLUMNS, toWheelItem } from '../wheel/loadWheelItems'
import type { WheelItem } from '../wheel/titles'

export interface FilmDetail extends WheelItem {
  letterboxdUri: string | null
}

// One film, everything the detail sheet shows, from the shared catalogue.
export async function loadFilmDetail(filmId: string): Promise<FilmDetail> {
  const { data, error } = await supabase
    .from('films')
    .select(`id, letterboxd_uri, ${FILM_DETAIL_COLUMNS}`)
    .eq('id', filmId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('That film is not in the catalogue.')
  return { ...toWheelItem(filmId, data, null), letterboxdUri: data.letterboxd_uri }
}
