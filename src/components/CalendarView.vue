<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import EventModal from './EventModal.vue'
import { localEventRepository } from '../services/eventStorage'
import type { CalendarEvent } from '../types/calendar'

interface CalendarDay {
  date: string
  dayNumber: number
  isCurrentMonth: boolean
  isToday: boolean
  events: CalendarEvent[]
}

const today = new Date()
const currentMonth = ref(new Date(today.getFullYear(), today.getMonth(), 1))
const events = ref<CalendarEvent[]>([])
const selectedDate = ref(toDateKey(today))
const editingEvent = ref<CalendarEvent | null>(null)
const isModalOpen = ref(false)
const isMonthPickerOpen = ref(false)
const isLoggedDatesOpen = ref(false)
const toastMessage = ref('')
const loggedDatesMenu = ref<HTMLElement | null>(null)
const pickerMonth = ref(currentMonth.value.getMonth())
const pickerYear = ref(currentMonth.value.getFullYear())
let toastTimeoutId: number | undefined

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: index,
  shortLabel: `${String(index + 1).padStart(2, '0')} - ${new Intl.DateTimeFormat('en', {
    month: 'short',
  }).format(new Date(2026, index, 1))}`,
  label: new Intl.DateTimeFormat('en', {
    month: 'long',
  }).format(new Date(2026, index, 1)),
}))

const monthLabel = computed(() =>
  `${String(currentMonth.value.getMonth() + 1).padStart(2, '0')} - ${new Intl.DateTimeFormat(
    'en',
    {
      month: 'long',
      year: 'numeric',
    },
  ).format(currentMonth.value)}`,
)

const loggedDates = computed(() => {
  const eventsByDate = new Map<string, CalendarEvent[]>()

  for (const event of events.value) {
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

onMounted(() => {
  events.value = localEventRepository.list()
  document.addEventListener('click', closeLoggedDatesOnOutsideClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeLoggedDatesOnOutsideClick)

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

function moveMonth(direction: number) {
  currentMonth.value = new Date(
    currentMonth.value.getFullYear(),
    currentMonth.value.getMonth() + direction,
    1,
  )
}

function openMonthPicker() {
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
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
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

function closeLoggedDatesOnOutsideClick(event: MouseEvent) {
  if (!isLoggedDatesOpen.value) {
    return
  }

  const target = event.target

  if (target instanceof Node && loggedDatesMenu.value?.contains(target)) {
    return
  }

  isLoggedDatesOpen.value = false
}

function openNewEvent(date = selectedDate.value) {
  selectedDate.value = date

  const eventToEdit = events.value.find((event) => event.date === date)

  if (eventToEdit) {
    openExistingEvent(eventToEdit)
    return
  }

  editingEvent.value = null
  isModalOpen.value = true
}

function openExistingEvent(event: CalendarEvent) {
  selectedDate.value = event.date
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

function dismissToast() {
  toastMessage.value = ''

  if (toastTimeoutId) {
    window.clearTimeout(toastTimeoutId)
    toastTimeoutId = undefined
  }
}

function saveEvent(event: CalendarEvent) {
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
      return
    }
  }

  events.value = localEventRepository.save(event)
  isModalOpen.value = false
  isLoggedDatesOpen.value = false
  isMonthPickerOpen.value = false
  showToast(isUpdate ? 'Edit successful' : 'Date plan saved')
}

function deleteEvent(id: string) {
  events.value = localEventRepository.delete(id)
  isModalOpen.value = false
  isLoggedDatesOpen.value = false
  isMonthPickerOpen.value = false
  showToast('Date plan deleted')
}
</script>

<template>
  <main class="min-h-screen bg-[#f7f5ef] text-[#16251f]">
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
          class="flex items-center justify-between rounded-md border border-[#d7c8b5] bg-[#fffdf8] px-4 py-3 text-sm font-medium text-[#16251f] shadow-xl shadow-stone-950/10"
          role="status"
          aria-live="polite"
        >
          <div class="mr-3 flex-1 text-left text-sm">{{ toastMessage }}</div>
          <button
            type="button"
            class="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-200 text-sm text-stone-600 transition hover:bg-[#f4efe6] focus:outline-none focus:ring-2 focus:ring-[#9fb5a9]"
            aria-label="Dismiss notification"
            @click="dismissToast"
          >
            &times;
          </button>
        </div>
      </div>
    </Transition>

    <div class="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-3 py-3 sm:px-6 sm:py-6">
      <section class="relative flex-1 rounded-lg border border-[#d7c8b5] bg-[#fffdf8] shadow-sm shadow-stone-950/5">
        <div class="flex items-center justify-between gap-2 border-b border-[#d7c8b5] p-3 sm:p-4">
          <button
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-stone-200 text-xl text-stone-600 transition hover:border-[#bca889] hover:bg-[#f4efe6] hover:text-[#163c2f] focus:outline-none focus:ring-2 focus:ring-[#9fb5a9]"
            type="button"
            aria-label="Previous month"
            @click="moveMonth(-1)"
          >
            &lsaquo;
          </button>

          <button
            class="min-w-0 flex-1 rounded-md px-2 py-2 text-center text-lg font-semibold text-[#16251f] transition hover:bg-[#f4efe6] focus:outline-none focus:ring-2 focus:ring-[#9fb5a9] sm:text-2xl"
            type="button"
            @click="openMonthPicker"
          >
            {{ monthLabel }}
          </button>

          <button
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-stone-200 text-xl text-stone-600 transition hover:border-[#bca889] hover:bg-[#f4efe6] hover:text-[#163c2f] focus:outline-none focus:ring-2 focus:ring-[#9fb5a9]"
            type="button"
            aria-label="Next month"
            @click="moveMonth(1)"
          >
            &rsaquo;
          </button>

          <div ref="loggedDatesMenu" class="relative">
            <button
              class="ml-1 rounded-md border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-[#bca889] hover:bg-[#f4efe6] focus:outline-none focus:ring-2 focus:ring-[#9fb5a9]"
              type="button"
              @click="isLoggedDatesOpen = !isLoggedDatesOpen"
            >
              Dates
            </button>

            <div
              v-if="isLoggedDatesOpen"
              class="absolute right-0 top-12 z-20 max-h-80 w-72 overflow-y-auto rounded-lg border border-[#d7c8b5] bg-[#fffdf8] p-2 text-left shadow-xl shadow-stone-950/10"
            >
              <p v-if="loggedDates.length === 0" class="px-3 py-4 text-sm text-stone-500">
                No dates logged yet.
              </p>

              <button
                v-for="loggedDate in loggedDates"
                :key="loggedDate.date"
                class="w-full rounded-md px-3 py-2.5 text-left transition hover:bg-[#f4efe6] focus:outline-none focus:ring-2 focus:ring-[#9fb5a9]"
                type="button"
                @click="goToLoggedDate(loggedDate.date)"
              >
                <span class="block text-sm font-semibold text-[#16251f]">{{ loggedDate.label }}</span>
                <span class="mt-0.5 block truncate text-xs text-stone-500">
                  {{ loggedDate.events.map((event) => event.title).join(', ') }}
                </span>
              </button>
            </div>
          </div>
        </div>

          <div class="grid grid-cols-7 border-b border-[#d7c8b5] bg-[#f4efe6] text-center text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#7a5d3b] sm:text-xs sm:tracking-[0.14em]">
            <div v-for="day in weekdayLabels" :key="day" class="py-3">{{ day }}</div>
          </div>

          <div class="grid grid-cols-7">
            <div
              v-for="day in calendarDays"
              :key="day.date"
              class="min-h-16 cursor-pointer border-b border-r border-[#e3d8c9] p-1.5 text-left transition hover:bg-[#f4efe6] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#6f8f7a] sm:min-h-28 sm:p-3 [&:nth-child(7n)]:border-r-0"
              :class="[
                day.events.length > 0
                  ? 'bg-[#e8efe9]'
                  : day.isCurrentMonth
                    ? 'bg-[#fffdf8]'
                    : 'bg-[#f1eee7] text-stone-400',
                selectedDate === day.date ? 'ring-2 ring-inset ring-[#6f8f7a]' : '',
              ]"
              role="button"
              tabindex="0"
              @click="openNewEvent(day.date)"
              @keydown.enter.prevent="openNewEvent(day.date)"
              @keydown.space.prevent="openNewEvent(day.date)"
            >
              <span class="flex items-center justify-between gap-2">
                <span
                  class="flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold sm:h-7 sm:w-7 sm:text-sm"
                  :class="day.isToday ? 'bg-[#163c2f] text-white' : 'text-stone-700'"
                >
                  {{ day.dayNumber }}
                </span>
                <span v-if="day.events.length" class="text-[0.65rem] font-medium text-[#163c2f] sm:text-xs">
                  {{ day.events.length }}
                </span>
              </span>

              <span v-if="day.events.length" class="mt-2 flex gap-1 sm:hidden">
                <span
                  v-for="event in day.events.slice(0, 3)"
                  :key="event.id"
                  class="h-1.5 w-1.5 rounded-full bg-[#163c2f]"
                />
              </span>

              <span class="mt-3 hidden flex-col gap-1.5 sm:flex">
                <button
                  v-for="event in day.events"
                  :key="event.id"
                  class="truncate rounded-md bg-[#dfe8e1] px-2 py-1 text-left text-xs font-medium text-[#163c2f] transition hover:bg-[#cfddcf] focus:outline-none focus:ring-2 focus:ring-[#6f8f7a]"
                  type="button"
                  @click.stop="openExistingEvent(event)"
                >
                  {{ event.title }}
                </button>
              </span>
            </div>
          </div>
      </section>
    </div>

    <EventModal
      v-if="isModalOpen"
      :date="selectedDate"
      :event="editingEvent"
      @close="isModalOpen = false"
      @delete="deleteEvent"
      @save="saveEvent"
    />

    <div
      v-if="isMonthPickerOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/35 p-3 backdrop-blur-sm"
      @click.self="isMonthPickerOpen = false"
    >
      <section class="relative w-full rounded-lg border border-stone-200 bg-[#fffdf8] p-5 text-left shadow-2xl shadow-stone-950/15 sm:max-w-md">
        <button
          class="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-md border border-stone-200 text-xl leading-none text-stone-500 transition hover:border-[#d4c6b3] hover:bg-[#f4efe6] hover:text-[#163c2f] focus:outline-none focus:ring-2 focus:ring-[#9fb5a9]"
          type="button"
          aria-label="Close month picker"
          @click="isMonthPickerOpen = false"
        >
          &times;
        </button>

        <form class="space-y-4" @submit.prevent="goToPickedMonth">
          <div>
            <span class="text-sm font-medium text-stone-700">Month</span>
            <div class="mt-2 grid grid-cols-3 gap-2">
              <button
                v-for="month in monthOptions"
                :key="month.value"
                class="rounded-md border px-3 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[#9fb5a9]"
                :class="[
                  pickerMonth === month.value
                    ? 'border-[#163c2f] bg-[#163c2f] text-white'
                    : isActualCurrentMonth(month.value)
                      ? 'border-[#7a5d3b] bg-[#efe6d8] text-[#5b4329]'
                      : 'border-stone-200 bg-white text-stone-700 hover:bg-[#f4efe6]',
                ]"
                type="button"
                @click="pickerMonth = month.value"
              >
                {{ month.shortLabel }}
              </button>
            </div>
          </div>

          <div>
            <span class="text-sm font-medium text-stone-700">Year</span>
            <div class="mt-2 flex w-full items-center">
              <button
                type="button"
                class="flex-none rounded-md border px-3 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[#9fb5a9]"
                aria-label="Previous year"
                @click="changePickerYear(-1)"
              >
                &lsaquo;
              </button>

              <div class="flex-1 text-center rounded-md border border-stone-200 bg-white px-3 py-2.5 text-[#16251f] text-sm font-medium mx-2">
                {{ pickerYear }}
              </div>

              <button
                type="button"
                class="flex-none rounded-md border px-3 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[#9fb5a9]"
                aria-label="Next year"
                @click="changePickerYear(1)"
              >
                &rsaquo;
              </button>
            </div>
          </div>

          <div class="flex gap-3 pt-2">
            <button
              class="flex-1 rounded-md border border-stone-200 px-4 py-2.5 font-medium text-stone-700 transition hover:bg-[#f4efe6] focus:outline-none focus:ring-2 focus:ring-stone-200"
              type="button"
              @click="isMonthPickerOpen = false"
            >
              Cancel
            </button>
            <button
              class="flex-1 rounded-md bg-[#163c2f] px-4 py-2.5 font-semibold text-white transition hover:bg-[#0f2b22] focus:outline-none focus:ring-2 focus:ring-[#9fb5a9]"
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
