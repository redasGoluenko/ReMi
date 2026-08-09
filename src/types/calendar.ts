export interface CalendarEvent {
  id: string
  date: string | null
  title: string
  description: string
  isIdea: boolean
}

export type CalendarEventDraft = Omit<CalendarEvent, 'id'>
