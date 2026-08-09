<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CalendarEvent } from '../types/calendar'

const props = defineProps<{
  date: string
  event: CalendarEvent | null
}>()

const emit = defineEmits<{
  close: []
  delete: [id: string]
  save: [event: CalendarEvent]
}>()

const title = ref('')
const description = ref('')

const formattedDate = computed(() =>
  new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${props.date}T12:00:00`)),
)

const isEditing = computed(() => Boolean(props.event))
const canSave = computed(() => title.value.trim().length > 0)

watch(
  () => props.event,
  (event) => {
    title.value = event?.title ?? ''
    description.value = event?.description ?? ''
  },
  { immediate: true },
)

const saveEvent = () => {
  if (!canSave.value) {
    return
  }

  emit('save', {
    id: props.event?.id ?? crypto.randomUUID(),
    date: props.date,
    title: title.value.trim(),
    description: description.value.trim(),
  })
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/35 p-3 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <section class="w-full rounded-lg border border-stone-200 bg-[#fffdf8] p-5 text-left shadow-2xl shadow-stone-950/15 sm:max-w-lg sm:p-6">
      <div class="mb-5 flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-medium uppercase tracking-[0.16em] text-[#7a5d3b]">{{ formattedDate }}</p>
          <h2 class="mt-2 text-2xl font-semibold text-[#16251f]">
            {{ isEditing ? 'Edit event' : 'Add a date' }}
          </h2>
        </div>
        <button
          class="flex h-9 w-9 items-center justify-center rounded-md border border-stone-200 text-xl leading-none text-stone-500 transition hover:border-[#d4c6b3] hover:bg-[#f4efe6] hover:text-[#163c2f] focus:outline-none focus:ring-2 focus:ring-[#9fb5a9]"
          type="button"
          aria-label="Close modal"
          @click="emit('close')"
        >
          &times;
        </button>
      </div>

      <form class="space-y-4" @submit.prevent="saveEvent">
        <label class="block">
          <span class="text-sm font-medium text-stone-700">Title</span>
          <input
            v-model="title"
            class="mt-2 w-full rounded-md border border-stone-200 bg-white px-3 py-2.5 text-[#16251f] outline-none transition placeholder:text-stone-400 focus:border-[#6f8f7a] focus:ring-4 focus:ring-[#dfe8e1]"
            type="text"
            placeholder="Dinner, walk, weekend plan..."
            autocomplete="off"
          />
        </label>

        <label class="block">
          <span class="text-sm font-medium text-stone-700">Description</span>
          <textarea
            v-model="description"
            class="mt-2 min-h-32 w-full resize-y rounded-md border border-stone-200 bg-white px-3 py-2.5 text-[#16251f] outline-none transition placeholder:text-stone-400 focus:border-[#6f8f7a] focus:ring-4 focus:ring-[#dfe8e1]"
            placeholder="Optional details."
          />
        </label>

        <p v-if="!canSave" class="text-sm text-stone-500">Title is required.</p>

        <div class="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            v-if="event"
            class="rounded-md border border-red-200 px-4 py-2.5 font-medium text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
            type="button"
            @click="emit('delete', event.id)"
          >
            Delete
          </button>

          <div class="flex gap-3 sm:ml-auto">
            <button
              class="flex-1 rounded-md border border-stone-200 px-4 py-2.5 font-medium text-stone-700 transition hover:bg-[#f4efe6] focus:outline-none focus:ring-2 focus:ring-stone-200 sm:flex-none"
              type="button"
              @click="emit('close')"
            >
              Cancel
            </button>
            <button
              class="flex-1 rounded-md bg-[#163c2f] px-4 py-2.5 font-semibold text-white transition hover:bg-[#0f2b22] focus:outline-none focus:ring-2 focus:ring-[#9fb5a9] disabled:cursor-not-allowed disabled:bg-stone-300 sm:flex-none"
              type="submit"
              :disabled="!canSave"
            >
              Save
            </button>
          </div>
        </div>
      </form>
    </section>
  </div>
</template>
