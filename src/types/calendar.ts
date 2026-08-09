export interface CalendarEvent {
  id: string
  date: string
  title: string
  description: string
}

export type CalendarEventDraft = Omit<CalendarEvent, 'id'>
