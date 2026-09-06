import { getSupabaseClient } from './supabaseClient'
import type { Painting, PaintingAuthor } from '../types/painting'

const SELECT_COLUMNS = 'id, author, image_data, created_at'

interface PaintingRow {
  id: string
  author: PaintingAuthor
  image_data: string
  created_at: string
}

const mapRowToPainting = (row: PaintingRow): Painting => ({
  id: row.id,
  author: row.author,
  imageData: row.image_data,
  createdAt: row.created_at,
})

export interface PaintingRepository {
  list(): Promise<Painting[]>
  create(painting: Pick<Painting, 'id' | 'author' | 'imageData'>): Promise<Painting>
}

export const supabasePaintingRepository: PaintingRepository = {
  async list() {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('paintings')
      .select(SELECT_COLUMNS)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(error.message)
    }

    return (data ?? []).map(mapRowToPainting)
  },
  async create(painting) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('paintings')
      .insert({
        id: painting.id,
        author: painting.author,
        image_data: painting.imageData,
      })
      .select(SELECT_COLUMNS)
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return mapRowToPainting(data)
  },
}
