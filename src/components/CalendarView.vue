<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import EventModal from './EventModal.vue'
import DateIdeaModal from './DateIdeaModal.vue'
import PaintingModal from './PaintingModal.vue'
import { supabaseEventRepository } from '../services/eventStorage'
import { supabasePaintingRepository } from '../services/paintingStorage'
import type { CalendarEvent } from '../types/calendar'
import type { Painting, PaintingAuthor } from '../types/painting'

interface CalendarDay {
  date: string
  dayNumber: number
  isCurrentMonth: boolean
  isToday: boolean
  events: CalendarEvent[]
}

const today = new Date()
const PAINTING_VIEWER_KEY = 'remi.painting.viewer'
const DISMISSED_PAINTINGS_KEY = 'remi.painting.dismissed'
const currentMonth = ref(new Date(today.getFullYear(), today.getMonth(), 1))
const events = ref<CalendarEvent[]>([])
const paintings = ref<Painting[]>([])
const paintingViewer = ref<PaintingAuthor | null>(readPaintingViewer())
const dismissedPaintingIds = ref<string[]>(readDismissedPaintingIds())
const selectedDate = ref(toDateKey(today))
const modalDate = ref(toDateKey(today))
const editingEvent = ref<CalendarEvent | null>(null)
const isModalOpen = ref(false)
const isIdeaModalOpen = ref(false)
const isPaintingModalOpen = ref(false)
const isMonthPickerOpen = ref(false)
const isLoggedDatesOpen = ref(false)
const isIdeasOpen = ref(false)
const isLoadingEvents = ref(false)
const isSavingEvent = ref(false)
const isDeletingEvent = ref(false)
const isSavingPainting = ref(false)
const loadError = ref('')
const toastMessage = ref('')
const loggedDatesMenu = ref<HTMLElement | null>(null)
const ideasMenu = ref<HTMLElement | null>(null)
const pickerMonth = ref(currentMonth.value.getMonth())
const pickerYear = ref(currentMonth.value.getFullYear())
const editingIdea = ref<CalendarEvent | null>(null)
const relationshipStart = new Date('2026-07-11T00:00:00')
const relationshipDuration = ref('')
let relationshipIntervalId: number | undefined
let toastTimeoutId: number | undefined
let isClosingDatesMenu = false
let touchStartX = 0
let touchStartY = 0
let touchStartTime = 0

const weekdayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: index,
  shortLabel: `${String(index + 1).padStart(2, '0')} - ${formatBilingualMonth(new Date(2026, index, 1), 'short')}`,
  label: formatBilingualMonth(new Date(2026, index, 1)),
}))

const monthLabel = computed(() =>
  `${formatBilingualMonth(currentMonth.value)} ${currentMonth.value.getFullYear()}`,
)

const unreadPaintings = computed(() => {
  if (!paintingViewer.value) {
    return []
  }

  const dismissed = new Set(dismissedPaintingIds.value)

  return paintings.value.filter(
    (painting) => painting.author !== paintingViewer.value && !dismissed.has(painting.id),
  )
})

const hasUnreadPaintings = computed(() => unreadPaintings.value.length > 0)

function updateRelationshipDuration() {
  const now = new Date()
  let years = now.getFullYear() - relationshipStart.getFullYear()
  let months = now.getMonth() - relationshipStart.getMonth()
  let days = now.getDate() - relationshipStart.getDate()

  if (days < 0) {
    const previousMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    days += previousMonth.getDate()
    months -= 1
  }

  if (months < 0) {
    months += 12
    years -= 1
  }

  const totalMonths = years * 12 + months

  relationshipDuration.value = `${totalMonths} months • ${days} days`
}

const loggedDates = computed(() => {
  const eventsByDate = new Map<string, CalendarEvent[]>()

  for (const event of events.value) {
    if (!event.date) {
      continue
    }

    eventsByDate.set(event.date, [...(eventsByDate.get(event.date) ?? []), event])
  }

  return Array.from(eventsByDate.entries())
    .map(([date, dateEvents]) => ({
      date,
      label: formatDate(date),
      events: dateEvents.sort((first, second) => first.title.localeCompare(second.title)),
    }))
    .sort((first, second) => first.date.localeCompare(second.date))
})

const dateIdeas = computed(() =>
  events.value
    .filter((event) => event.isIdea)
    .sort((first, second) => {
      const firstDate = first.date ?? '9999-12-31'
      const secondDate = second.date ?? '9999-12-31'

      if (firstDate !== secondDate) {
        return firstDate.localeCompare(secondDate)
      }

      return first.title.localeCompare(second.title)
    }),
)

const calendarDays = computed<CalendarDay[]>(() => {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const firstGridDate = new Date(firstOfMonth)
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7
  firstGridDate.setDate(firstOfMonth.getDate() - mondayOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstGridDate)
    date.setDate(firstGridDate.getDate() + index)
    const dateKey = toDateKey(date)

    return {
      date: dateKey,
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      isToday: dateKey === toDateKey(today),
      events: events.value.filter((event) => event.date === dateKey),
    }
  })
})

onMounted(async () => {
  updateRelationshipDuration()
  relationshipIntervalId = window.setInterval(updateRelationshipDuration, 60_000)
  await loadEvents()
  await loadPaintings()
  document.addEventListener('click', closeLoggedDatesOnOutsideClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeLoggedDatesOnOutsideClick)

  if (relationshipIntervalId) {
    window.clearInterval(relationshipIntervalId)
  }

  if (toastTimeoutId) {
    window.clearTimeout(toastTimeoutId)
  }
})

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function readPaintingViewer(): PaintingAuthor | null {
  const storedViewer = window.localStorage.getItem(PAINTING_VIEWER_KEY)

  if (storedViewer === 'redas' || storedViewer === 'migle') {
    return storedViewer
  }

  return null
}

function readDismissedPaintingIds(): string[] {
  const rawDismissed = window.localStorage.getItem(DISMISSED_PAINTINGS_KEY)

  if (!rawDismissed) {
    return []
  }

  try {
    const parsedDismissed = JSON.parse(rawDismissed)

    if (!Array.isArray(parsedDismissed)) {
      return []
    }

    return parsedDismissed.filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}

function writeDismissedPaintingIds(ids: string[]) {
  window.localStorage.setItem(DISMISSED_PAINTINGS_KEY, JSON.stringify(ids))
}

function openPaintings() {
  isPaintingModalOpen.value = true
}

function choosePaintingViewer(viewer: PaintingAuthor) {
  paintingViewer.value = viewer
  window.localStorage.setItem(PAINTING_VIEWER_KEY, viewer)
}

function dismissPainting(id: string) {
  if (dismissedPaintingIds.value.includes(id)) {
    return
  }

  dismissedPaintingIds.value = [...dismissedPaintingIds.value, id]
  writeDismissedPaintingIds(dismissedPaintingIds.value)
}

function moveMonth(direction: number) {
  if (isLoggedDatesOpen.value) {
    return
  }

  currentMonth.value = new Date(
    currentMonth.value.getFullYear(),
    currentMonth.value.getMonth() + direction,
    1,
  )
}

function handleSwipeStart(event: TouchEvent) {
  if (isModalOpen.value || isIdeaModalOpen.value || isMonthPickerOpen.value) {
    return
  }

  if (isLoggedDatesOpen.value || isIdeasOpen.value) {
    return
  }

  const touch = event.touches[0]

  if (!touch) {
    return
  }

  touchStartX = touch.clientX
  touchStartY = touch.clientY
  touchStartTime = Date.now()
}

function handleSwipeEnd(event: TouchEvent) {
  if (!touchStartTime) {
    return
  }

  const touch = event.changedTouches[0]

  if (!touch) {
    return
  }

  const deltaX = touch.clientX - touchStartX
  const deltaY = touch.clientY - touchStartY
  const elapsed = Date.now() - touchStartTime

  touchStartTime = 0

  const horizontalDistance = Math.abs(deltaX)
  const verticalDistance = Math.abs(deltaY)
  const swipeThreshold = 48

  if (elapsed > 900 || horizontalDistance < swipeThreshold || horizontalDistance <= verticalDistance) {
    return
  }

  if (deltaX < 0) {
    moveMonth(1)
  } else {
    moveMonth(-1)
  }
}

function handleSwipeCancel() {
  touchStartTime = 0
}

function goToToday() {
  currentMonth.value = new Date(today.getFullYear(), today.getMonth(), 1)
}

function openDateIdeas() {
  if (isLoggedDatesOpen.value || isMonthPickerOpen.value) {
    return
  }

  isIdeasOpen.value = !isIdeasOpen.value
}

function openMonthPicker() {
  if (isLoggedDatesOpen.value) {
    return
  }

  pickerMonth.value = currentMonth.value.getMonth()
  pickerYear.value = currentMonth.value.getFullYear()
  isMonthPickerOpen.value = true
}

function goToPickedMonth() {
  currentMonth.value = new Date(pickerYear.value, pickerMonth.value, 1)
  isMonthPickerOpen.value = false
}

function changePickerYear(delta: number) {
  const minYear = 1900
  const maxYear = 2100
  const newYear = Math.max(minYear, Math.min(maxYear, pickerYear.value + delta))
  pickerYear.value = newYear
}

function isActualCurrentMonth(month: number): boolean {
  return month === today.getMonth() && pickerYear.value === today.getFullYear()
}

function formatDate(date: string): string {
  const targetDate = new Date(`${date}T12:00:00`)
  const englishMonth = new Intl.DateTimeFormat('en', { month: 'short' }).format(targetDate)
  const lithuanianMonth = new Intl.DateTimeFormat('lt', { month: 'short' }).format(targetDate)
  const day = new Intl.DateTimeFormat('en', { day: 'numeric' }).format(targetDate)
  const year = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(targetDate)

  return `${englishMonth} (${lithuanianMonth}) ${day}, ${year}`
}

function formatBilingualMonth(date: Date, monthStyle: Intl.DateTimeFormatOptions['month'] = 'long') {
  const englishMonth = new Intl.DateTimeFormat('en', {
    month: monthStyle,
  }).format(date)
  const lithuanianMonth = new Intl.DateTimeFormat('lt', {
    month: 'long',
  }).format(date)

  return `${englishMonth} (${lithuanianMonth})`
}

function goToLoggedDate(date: string) {
  const targetDate = new Date(`${date}T12:00:00`)
  const eventToEdit = events.value.find((event) => event.date === date)

  currentMonth.value = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
  selectedDate.value = date
  isLoggedDatesOpen.value = false

  if (eventToEdit) {
    openExistingEvent(eventToEdit)
  }
}

function openIdeaModal(idea: CalendarEvent | null = null) {
  if (isClosingDatesMenu || isLoggedDatesOpen.value) {
    return
  }

  editingIdea.value = idea ? { ...idea } : null
  isIdeaModalOpen.value = true
}

function closeLoggedDatesOnOutsideClick(event: MouseEvent) {
  if (!isLoggedDatesOpen.value && !isIdeasOpen.value) {
    return
  }

  const target = event.target

  if (
    target instanceof Node &&
    (loggedDatesMenu.value?.contains(target) || ideasMenu.value?.contains(target))
  ) {
    return
  }

  isLoggedDatesOpen.value = false
  isIdeasOpen.value = false
  isClosingDatesMenu = true
  
  setTimeout(() => {
    isClosingDatesMenu = false
  }, 0)
}

function openNewEvent(date = selectedDate.value) {
  if (isClosingDatesMenu || isLoggedDatesOpen.value || isIdeasOpen.value) {
    return
  }

  modalDate.value = date

  const eventToEdit = events.value.find((event) => event.date === date)

  if (eventToEdit) {
    openExistingEvent(eventToEdit)
    return
  }

  editingEvent.value = null
  isModalOpen.value = true
}

function openExistingEvent(event: CalendarEvent) {
  modalDate.value = event.date ?? selectedDate.value
  editingEvent.value = { ...event }
  isModalOpen.value = true
}

function showToast(message: string) {
  toastMessage.value = message

  if (toastTimeoutId) {
    window.clearTimeout(toastTimeoutId)
  }

  toastTimeoutId = window.setTimeout(() => {
    toastMessage.value = ''
  }, 2000)
}

function showIdeaToast(message: string) {
  showToast(message)
}

function dismissToast() {
  toastMessage.value = ''

  if (toastTimeoutId) {
    window.clearTimeout(toastTimeoutId)
    toastTimeoutId = undefined
  }
}

async function loadEvents() {
  isLoadingEvents.value = true
  loadError.value = ''

  try {
    events.value = await supabaseEventRepository.list()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    loadError.value = `Could not load dates: ${message}`
    showToast('Could not load dates')
  } finally {
    isLoadingEvents.value = false
  }
}

async function loadPaintings() {
  try {
    paintings.value = await supabasePaintingRepository.list()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    showToast(`Could not load paintings: ${message}`)
  }
}

async function savePainting(imageData: string) {
  if (isSavingPainting.value || !paintingViewer.value) {
    return
  }

  isSavingPainting.value = true

  try {
    const savedPainting = await supabasePaintingRepository.create({
      id: crypto.randomUUID(),
      author: paintingViewer.value,
      imageData,
    })

    paintings.value.push(savedPainting)
    isPaintingModalOpen.value = false
    showToast('Painting sent')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    showToast(`Could not send painting: ${message}`)
  } finally {
    isSavingPainting.value = false
  }
}

async function saveEvent(event: CalendarEvent) {
  if (isSavingEvent.value || isDeletingEvent.value) {
    return
  }

  const storedEvent = events.value.find((stored) => stored.id === event.id)
  const isUpdate = Boolean(storedEvent)

  if (isUpdate) {
    const unchanged =
      storedEvent!.title === event.title &&
      storedEvent!.description === event.description &&
      storedEvent!.date === event.date

    if (unchanged) {
      isModalOpen.value = false
      isLoggedDatesOpen.value = false
      isMonthPickerOpen.value = false
      return
    }
  }

  isSavingEvent.value = true

  try {
    const savedEvent = isUpdate
      ? await supabaseEventRepository.update(event)
      : await supabaseEventRepository.create(event)

    if (isUpdate) {
      const index = events.value.findIndex((stored) => stored.id === savedEvent.id)

      if (index >= 0) {
        events.value.splice(index, 1, savedEvent)
      } else {
        events.value.push(savedEvent)
      }
    } else {
      events.value.push(savedEvent)
    }

    isModalOpen.value = false
    isLoggedDatesOpen.value = false
    isMonthPickerOpen.value = false
    loadError.value = ''
    showToast(isUpdate ? 'Edit successful' : 'Date plan saved')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    showToast(`Could not save date: ${message}`)
  } finally {
    isSavingEvent.value = false
  }
}

async function deleteEvent(id: string) {
  if (isSavingEvent.value || isDeletingEvent.value) {
    return
  }

  isDeletingEvent.value = true

  try {
    await supabaseEventRepository.delete(id)
    events.value = events.value.filter((event) => event.id !== id)
    isModalOpen.value = false
    isLoggedDatesOpen.value = false
    isMonthPickerOpen.value = false
    loadError.value = ''
    showToast('Date plan deleted')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    showToast(`Could not delete date: ${message}`)
  } finally {
    isDeletingEvent.value = false
  }
}

async function saveIdea(idea: CalendarEvent) {
  if (isSavingEvent.value || isDeletingEvent.value) {
    return
  }

  const storedIdea = events.value.find((stored) => stored.id === idea.id)
  const isUpdate = Boolean(storedIdea)

  if (isUpdate) {
    const unchanged =
      storedIdea!.title === idea.title &&
      storedIdea!.description === idea.description &&
      storedIdea!.date === idea.date &&
      storedIdea!.isIdea === idea.isIdea

    if (unchanged) {
      isIdeaModalOpen.value = false
      return
    }
  }

  isSavingEvent.value = true

  try {
    const savedIdea = isUpdate
      ? await supabaseEventRepository.update(idea)
      : await supabaseEventRepository.create(idea)

    if (isUpdate) {
      const index = events.value.findIndex((stored) => stored.id === savedIdea.id)

      if (index >= 0) {
        events.value.splice(index, 1, savedIdea)
      } else {
        events.value.push(savedIdea)
      }
    } else {
      events.value.push(savedIdea)
    }

    isIdeaModalOpen.value = false
    loadError.value = ''
    showIdeaToast(isUpdate ? 'Idea updated' : 'Idea saved')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    showIdeaToast(`Could not save idea: ${message}`)
  } finally {
    isSavingEvent.value = false
  }
}

async function deleteIdea(id: string) {
  await deleteEvent(id)
  isIdeaModalOpen.value = false
}
  </script>

  <template>
  <main class="relative h-full overflow-hidden text-[#f7ebd7]">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-2 opacity-0"
    >
      <div v-if="toastMessage" class="fixed left-1/2 bottom-6 z-[60] w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2">
        <div
          class="flex items-center justify-between rounded-full border border-[#ead9c6]/80 bg-[#f7eddc]/95 px-4 py-3 text-sm font-medium text-[#2f261b] shadow-2xl shadow-black/25 backdrop-blur"
          role="status"
          aria-live="polite"
        >
          <div class="mr-3 flex-1 text-left text-sm">{{ toastMessage }}</div>
          <button
            type="button"
            class="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#d8c3a6] text-sm text-[#70543a] transition hover:bg-[#efe1cc] focus:outline-none focus:ring-2 focus:ring-[#b79460]"
            aria-label="Dismiss notification"
            @click="dismissToast"
          >
            &times;
          </button>
        </div>
      </div>
    </Transition>

    <div class="relative z-10 mx-auto flex h-full w-full max-w-5xl flex-col px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
      <header class="mb-5 pt-1 text-center text-[#f7ebd7] sm:mb-6 lg:mb-8">
        <button
          type="button"
          class="relative mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-[#cfab6a]/60 bg-[#1f2e1f]/35 text-[#cfab6a] shadow-lg shadow-black/20 backdrop-blur-sm transition hover:border-[#e0c17f] hover:bg-[#2a3c29]/45 focus:outline-none focus:ring-2 focus:ring-[#d5b376]"
          aria-label="Open paintings"
          @click="openPaintings"
        >
          <svg
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 0 1 4.03 4.03l-8.06 8.07" />
            <path d="M7.07 14.94c-1.66 0-3 1.34-3 3 0 1.1-.9 2-2 2 1.33 1.33 3.08 2 5 2a4 4 0 0 0 0-8Z" />
          </svg>

          <span
            v-if="hasUnreadPaintings"
            class="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 rounded-full border-2 border-[#1f2e1f] bg-[#d84a3a]"
            aria-hidden="true"
          />
        </button>

        <h1 class="text-4xl leading-none tracking-[0.01em] drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] sm:text-5xl lg:text-6xl">
          Redas &amp; Miglė
        </h1>

        <p class="mt-2 text-sm font-medium tracking-[0.08em] text-[#efe0c8]/75 sm:text-base">
          {{ relationshipDuration }}
        </p>
      </header>

      <div class="mb-4 flex items-center justify-between gap-3 text-[#f7ebd7] sm:mb-5">
        <button
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#d9c6ab]/55 bg-[#1d2419]/35 text-2xl text-[#f4e9d6] shadow-lg shadow-black/15 backdrop-blur-sm transition hover:border-[#e0caa5] hover:bg-[#2a3525]/45 focus:outline-none focus:ring-2 focus:ring-[#d5b376]"
          type="button"
          aria-label="Previous month"
          @click="moveMonth(-1)"
        >
          &lsaquo;
        </button>

        <button
          class="min-w-0 flex-1 rounded-full px-3 py-1 text-center text-2xl font-normal tracking-[0.01em] text-[#f7ebd7] drop-shadow-[0_2px_8px_rgba(0,0,0,0.28)] transition hover:text-white focus:outline-none focus:ring-2 focus:ring-[#d5b376] sm:text-3xl lg:text-[2.15rem]"
          type="button"
          @click="openMonthPicker"
        >
          {{ monthLabel }}
        </button>

        <button
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#d9c6ab]/55 bg-[#1d2419]/35 text-2xl text-[#f4e9d6] shadow-lg shadow-black/15 backdrop-blur-sm transition hover:border-[#e0caa5] hover:bg-[#2a3525]/45 focus:outline-none focus:ring-2 focus:ring-[#d5b376]"
          type="button"
          aria-label="Next month"
          @click="moveMonth(1)"
        >
          &rsaquo;
        </button>

        <div ref="loggedDatesMenu" class="relative ml-1">
          <button
            class="rounded-full border border-[#f1e4d1]/70 bg-[#f5e9db] px-4 py-3 text-sm font-medium text-[#4d3725] shadow-lg shadow-black/15 transition hover:bg-[#fff4e5] focus:outline-none focus:ring-2 focus:ring-[#d5b376] sm:px-5 sm:text-base"
            type="button"
            @click="isLoggedDatesOpen = !isLoggedDatesOpen"
          >
            ♡ Our Dates
          </button>

          <div
            v-if="isLoggedDatesOpen"
            class="absolute right-0 top-14 z-20 max-h-80 w-72 overflow-y-auto rounded-[1.5rem] border border-[#e7d1b5]/85 bg-[#f7eddc]/97 p-2 text-left shadow-2xl shadow-black/20 backdrop-blur-sm"
          >
            <p v-if="isLoadingEvents" class="px-3 py-4 text-sm text-[#6e5a46]">
              Loading dates...
            </p>

            <p v-else-if="loadError" class="px-3 py-4 text-sm text-red-800">
              {{ loadError }}
            </p>

            <p v-else-if="loggedDates.length === 0" class="px-3 py-4 text-sm text-[#6e5a46]">
              No dates logged yet.
            </p>

            <template v-else>
              <button
                v-for="loggedDate in loggedDates"
                :key="loggedDate.date"
                class="w-full rounded-2xl px-3 py-2.5 text-left transition hover:bg-[#efe0ca] focus:outline-none focus:ring-2 focus:ring-[#c9a369]"
                type="button"
                @click="goToLoggedDate(loggedDate.date)"
              >
                <span class="block text-sm font-semibold text-[#332519]">{{ loggedDate.label }}</span>
                <span class="mt-0.5 block truncate text-xs text-[#7a6754]">
                  {{ loggedDate.events.map((event) => event.title).join(', ') }}
                </span>
              </button>
            </template>
          </div>
        </div>
      </div>

      <section
        class="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[2.25rem] border border-[#f0dfc4]/80 bg-[rgba(246,233,213,0.94)] shadow-[0_35px_90px_rgba(20,14,8,0.35)] backdrop-blur-[12px]"
        @touchstart.passive="handleSwipeStart"
        @touchend.passive="handleSwipeEnd"
        @touchcancel="handleSwipeCancel"
      >
        <div class="grid grid-cols-7 border-b border-[#e3d1b8] bg-[#f0e2cd]/92 text-center text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#6e563a] sm:text-[0.8rem]">
          <div v-for="day in weekdayLabels" :key="day" class="py-3 sm:py-4">{{ day }}</div>
        </div>

        <div class="grid flex-1 grid-cols-7 grid-rows-6 min-h-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.18),rgba(255,255,255,0.04))]">
          <div
            v-for="day in calendarDays"
            :key="day.date"
            class="group min-h-0 cursor-pointer border-b border-r border-[#eadbc7] p-2 text-left transition hover:bg-[#efdfc8]/75 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#b88a44] sm:p-2.5 lg:p-3 [&:nth-child(7n)]:border-r-0"
            :class="[
              day.events.length > 0
                ? 'bg-[#e2d2b3] ring-2 ring-inset ring-[#d7c8a6] shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]'
                : day.isCurrentMonth
                  ? 'bg-transparent'
                  : 'bg-[#f4eee4]/70 text-[#9a8f81]',
              selectedDate === day.date && !day.isToday ? 'ring-2 ring-inset ring-[#7b5c29]' : '',
            ]"
            role="button"
            tabindex="0"
            @click="openNewEvent(day.date)"
            @keydown.enter.prevent="openNewEvent(day.date)"
            @keydown.space.prevent="openNewEvent(day.date)"
          >
            <span class="flex items-start justify-between gap-1 sm:gap-2">
              <span
                class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition sm:h-9 sm:w-9 sm:text-base"
                :class="[
                  day.isToday
                    ? 'bg-[#254f2c] text-white shadow-md shadow-[#254f2c]/35'
                    : selectedDate === day.date
                      ? 'border-2 border-[#a17024] text-[#5f4415]'
                      : day.isCurrentMonth
                        ? 'text-[#2a2118] group-hover:bg-[#e9d6bb]'
                        : 'text-[#9b9084]',
                ]"
              >
                {{ day.dayNumber }}
              </span>

            </span>

            <span class="mt-3 hidden flex-col gap-1.5 sm:flex">
              <button
                v-for="event in day.events"
                :key="event.id"
                class="truncate rounded-full bg-[#e2d2bf]/95 px-2.5 py-1 text-left text-xs font-medium text-[#2d2118] transition hover:bg-[#d8c1a4] focus:outline-none focus:ring-2 focus:ring-[#9a6f2c]"
                type="button"
                @click.stop="openExistingEvent(event)"
              >
                {{ event.title }}
              </button>
            </span>
          </div>
        </div>

        <div class="border-t border-[#e3d1b8] bg-[rgba(244,232,214,0.9)] p-3 sm:p-4 lg:p-5">
          <p v-if="isLoadingEvents" class="mb-2 text-center text-sm text-[#6e5a46]">Loading dates...</p>

          <div class="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              class="flex items-center justify-center gap-3 rounded-[1.4rem] border border-[#e3d1b8] bg-[#f5ead9] px-4 py-4 text-lg font-medium text-[#2f251b] shadow-sm transition hover:bg-[#f0dfc8] focus:outline-none focus:ring-2 focus:ring-[#b88a44]"
              @click="goToToday"
            >
              <span class="text-2xl leading-none text-[#2f6b3d]">☼</span>
              <span>Today</span>
            </button>

            <div ref="ideasMenu" class="relative">
              <button
                type="button"
                class="flex w-full items-center justify-center gap-3 rounded-[1.4rem] border border-[#2f6b3d] bg-[#244f2f] px-4 py-4 text-lg font-medium text-[#f7eddc] shadow-sm transition hover:bg-[#1f4328] focus:outline-none focus:ring-2 focus:ring-[#d5b376]"
                @click="openDateIdeas"
              >
                <span class="text-xl leading-none text-[#f3dca6]">☗</span>
                <span>Date Ideas</span>
              </button>

              <div
                v-if="isIdeasOpen"
                class="fixed inset-x-0 top-16 bottom-0 z-30 overflow-y-auto overscroll-contain rounded-t-[2rem] border-t border-[#e3d1b8] bg-[#f7eddc] p-2 text-left shadow-2xl shadow-black/20 sm:absolute sm:inset-x-0 sm:bottom-full sm:top-auto sm:mb-2 sm:w-full sm:max-h-[calc(100vh-14rem)] sm:rounded-[1.5rem] sm:border sm:border-[#e3d1b8]"
              >
                <p v-if="dateIdeas.length === 0" class="px-3 py-4 text-sm text-[#6e5a46]">
                  No date ideas yet.
                </p>

                <template v-else>
                  <button
                    v-for="idea in dateIdeas"
                    :key="idea.id"
                    type="button"
                    class="w-full rounded-2xl px-3 py-2.5 text-left transition hover:bg-[#eee0cd] focus:outline-none focus:ring-2 focus:ring-[#b88a44]"
                    @click="openIdeaModal(idea)"
                  >
                    <span class="block text-sm font-semibold text-[#2d2118]">{{ idea.title }}</span>
                    <span class="mt-0.5 block truncate text-xs text-[#7a6754]">
                      {{ idea.date ? formatDate(idea.date) : 'Set a date' }}
                    </span>
                  </button>
                </template>

                <button
                  type="button"
                  class="mt-2 w-full rounded-2xl border border-[#d8c3a6] px-3 py-2.5 text-sm font-medium text-[#4d3725] transition hover:bg-[#efe1cc] focus:outline-none focus:ring-2 focus:ring-[#b88a44]"
                  @click="openIdeaModal()"
                >
                  Add date idea
                </button>

                <button
                  type="button"
                  class="mt-2 w-full rounded-2xl border border-[#d8c3a6] px-3 py-2.5 text-sm font-medium text-[#4d3725] transition hover:bg-[#efe1cc] focus:outline-none focus:ring-2 focus:ring-[#b88a44]"
                  @click="isIdeasOpen = false"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <EventModal
      v-if="isModalOpen"
      :date="modalDate"
      :event="editingEvent"
      @close="isModalOpen = false"
      @delete="deleteEvent"
      @save="saveEvent"
    />

    <DateIdeaModal
      v-if="isIdeaModalOpen"
      :idea="editingIdea"
      @close="isIdeaModalOpen = false"
      @delete="deleteIdea"
      @save="saveIdea"
    />

    <PaintingModal
      v-if="isPaintingModalOpen"
      :viewer="paintingViewer"
      :unread-paintings="unreadPaintings"
      :is-saving="isSavingPainting"
      @close="isPaintingModalOpen = false"
      @choose-viewer="choosePaintingViewer"
      @dismiss="dismissPainting"
      @submit="savePainting"
    />

    <div
      v-if="isMonthPickerOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 backdrop-blur-md"
      @click.self="isMonthPickerOpen = false"
    >
      <section class="relative w-full rounded-[1.75rem] border border-[#ead9c6]/80 bg-[#f7eddc] p-4 text-left shadow-2xl shadow-black/25 sm:max-w-md md:max-w-lg lg:max-w-xl">
        <button
          class="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-[#d8c3a6] text-xl leading-none text-[#6f5136] transition hover:bg-[#efe1cc] hover:text-[#2f261b] focus:outline-none focus:ring-2 focus:ring-[#b88a44]"
          type="button"
          aria-label="Close month picker"
          @click="isMonthPickerOpen = false"
        >
          &times;
        </button>

        <form class="space-y-4" @submit.prevent="goToPickedMonth">
          <div>
            <span class="text-sm font-medium text-[#4d3725]">Month</span>
            <div class="mt-2 grid grid-cols-3 gap-2">
              <button
                v-for="month in monthOptions"
                :key="month.value"
                class="rounded-2xl border px-3 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[#b88a44]"
                :class="[
                  pickerMonth === month.value
                    ? 'border-[#244f2f] bg-[#244f2f] text-white'
                    : isActualCurrentMonth(month.value)
                      ? 'border-[#a17024] bg-[#efe0ca] text-[#5b4329]'
                      : 'border-[#ddccb6] bg-[#fff8ef] text-[#4d3725] hover:bg-[#efe1cc]',
                ]"
                type="button"
                @click="pickerMonth = month.value"
              >
                {{ month.shortLabel }}
              </button>
            </div>
          </div>

          <div>
            <span class="text-sm font-medium text-[#4d3725]">Year</span>
            <div class="mt-2 flex w-full items-center">
              <button
                type="button"
                class="flex-none rounded-2xl border border-[#ddccb6] px-3 py-2.5 text-sm font-medium text-[#4d3725] transition focus:outline-none focus:ring-2 focus:ring-[#b88a44]"
                aria-label="Previous year"
                @click="changePickerYear(-1)"
              >
                &lsaquo;
              </button>

              <div class="mx-2 flex-1 rounded-2xl border border-[#ddccb6] bg-[#fff8ef] px-3 py-2.5 text-center text-sm font-medium text-[#2f261b]">
                {{ pickerYear }}
              </div>

              <button
                type="button"
                class="flex-none rounded-2xl border border-[#ddccb6] px-3 py-2.5 text-sm font-medium text-[#4d3725] transition focus:outline-none focus:ring-2 focus:ring-[#b88a44]"
                aria-label="Next year"
                @click="changePickerYear(1)"
              >
                &rsaquo;
              </button>
            </div>
          </div>

          <div class="flex gap-3 pt-2">
            <button
              class="flex-1 rounded-2xl border border-[#ddccb6] px-4 py-2.5 font-medium text-[#4d3725] transition hover:bg-[#efe1cc] focus:outline-none focus:ring-2 focus:ring-[#b88a44]"
              type="button"
              @click="isMonthPickerOpen = false"
            >
              Cancel
            </button>
            <button
              class="flex-1 rounded-2xl bg-[#244f2f] px-4 py-2.5 font-semibold text-white transition hover:bg-[#1f4328] focus:outline-none focus:ring-2 focus:ring-[#d5b376]"
              type="submit"
            >
              Go
            </button>
          </div>
        </form>
      </section>
    </div>
  </main>
</template>
