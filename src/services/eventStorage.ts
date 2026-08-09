import type { CalendarEvent } from '../types/calendar'
import { getSupabaseClient } from './supabaseClient'

const STORAGE_KEY = 'remi.calendar.events'

export interface EventRepository {
  list(): Promise<CalendarEvent[]>
  create(event: CalendarEvent): Promise<CalendarEvent>
  update(event: CalendarEvent): Promise<CalendarEvent>
  delete(id: string): Promise<void>
}

export interface LegacyEventRepository {
  list(): CalendarEvent[]
  save(event: CalendarEvent): CalendarEvent[]
  delete(id: string): CalendarEvent[]
}

interface DateRow {
  id: string
  title: string
  description: string
  date: string | null
  is_idea: boolean
}

const mapRowToEvent = (row: DateRow): CalendarEvent => ({
  id: row.id,
  title: row.title,
  description: row.description,
  date: row.date,
  isIdea: row.is_idea,
})

const SELECT_COLUMNS = 'id, title, description, date, is_idea'

const readEvents = (): CalendarEvent[] => {
  const rawEvents = window.localStorage.getItem(STORAGE_KEY)

  if (!rawEvents) {
    return []
  }

  try {
    const parsedEvents = JSON.parse(rawEvents)

    if (!Array.isArray(parsedEvents)) {
      return []
    }

    return parsedEvents.filter(
      (event): event is CalendarEvent =>
        typeof event?.id === 'string' &&
        typeof event?.date === 'string' &&
        typeof event?.title === 'string' &&
        typeof event?.description === 'string',
    )
  } catch {
    return []
  }
}

const writeEvents = (events: CalendarEvent[]) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
}

export const supabaseEventRepository: EventRepository = {
  async list() {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('dates')
      .select(SELECT_COLUMNS)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(error.message)
    }

    return (data ?? []).map(mapRowToEvent)
  },
  async create(event) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('dates')
      .insert({
        id: event.id,
        title: event.title,
        description: event.description,
        date: event.date,
        is_idea: event.isIdea,
      })
      .select(SELECT_COLUMNS)
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return mapRowToEvent(data)
  },
  async update(event) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('dates')
      .update({
        title: event.title,
        description: event.description,
        date: event.date,
        is_idea: event.isIdea,
      })
      .eq('id', event.id)
      .select(SELECT_COLUMNS)
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return mapRowToEvent(data)
  },
  async delete(id) {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('dates').delete().eq('id', id)

    if (error) {
      throw new Error(error.message)
    }
  },
}

// Backward compatibility for stale hot-module imports during migration.
export const localEventRepository: LegacyEventRepository = {
  list() {
    return readEvents()
  },
  save(event) {
    const nextEvents = readEvents()
    const existingIndex = nextEvents.findIndex((storedEvent) => storedEvent.id === event.id)

    if (existingIndex >= 0) {
      nextEvents.splice(existingIndex, 1, event)
    } else {
      nextEvents.push(event)
    }

    writeEvents(nextEvents)
    return nextEvents
  },
  delete(id) {
    const nextEvents = readEvents().filter((event) => event.id !== id)
    writeEvents(nextEvents)
    return nextEvents
  },
}
