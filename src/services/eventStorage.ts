import type { CalendarEvent } from '../types/calendar'

const STORAGE_KEY = 'remi.calendar.events'

export interface EventRepository {
  list(): CalendarEvent[]
  save(event: CalendarEvent): CalendarEvent[]
  delete(id: string): CalendarEvent[]
}

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

export const localEventRepository: EventRepository = {
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
