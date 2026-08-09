<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { CalendarEvent } from '../types/calendar'
import { getSupabaseClient } from '../services/supabaseClient'

const emit = defineEmits<{
  back: []
}>()

const ideas = ref<CalendarEvent[]>([])
const isLoading = ref(true)
const loadError = ref('')

const isModalOpen = ref(false)
const editingIdea = ref<CalendarEvent | null>(null)

const title = ref('')
const description = ref('')

const isSaving = ref(false)

const loadIdeas = async () => {
  isLoading.value = true
  loadError.value = ''

  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('dates')
      .select('id, title, description, date, is_idea')
      .eq('is_idea', true)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(error.message)
    }

    ideas.value = (data ?? []).map((idea) => ({
      id: idea.id,
      title: idea.title,
      description: idea.description,
      date: idea.date ?? null,
      isIdea: Boolean(idea.is_idea),
    }))
  } catch (error) {
    loadError.value =
      error instanceof Error ? error.message : 'Could not load date ideas.'
  } finally {
    isLoading.value = false
  }
}

const openNewIdea = () => {
  editingIdea.value = null
  title.value = ''
  description.value = ''
  isModalOpen.value = true
}

const openExistingIdea = (idea: CalendarEvent) => {
  editingIdea.value = idea
  title.value = idea.title
  description.value = idea.description
  isModalOpen.value = true
}

const closeModal = () => {
  if (isSaving.value) {
    return
  }

  isModalOpen.value = false
}

const saveIdea = async () => {
  if (!title.value.trim() || isSaving.value) {
    return
  }

  isSaving.value = true

  try {
    const supabase = getSupabaseClient()

    if (editingIdea.value) {
      const { error } = await supabase
        .from('dates')
        .update({
          title: title.value.trim(),
          description: description.value.trim(),
          is_idea: true,
          date: null,
        })
        .eq('id', editingIdea.value.id)

      if (error) {
        throw new Error(error.message)
      }
    } else {
      const { error } = await supabase
        .from('dates')
        .insert({
          id: crypto.randomUUID(),
          title: title.value.trim(),
          description: description.value.trim(),
          date: null,
          is_idea: true,
        })

      if (error) {
        throw new Error(error.message)
      }
    }

    isModalOpen.value = false
    await loadIdeas()
  } catch (error) {
    loadError.value =
      error instanceof Error ? error.message : 'Could not save date idea.'
  } finally {
    isSaving.value = false
  }
}

const deleteIdea = async (idea: CalendarEvent) => {
  if (!confirm(`Delete "${idea.title}"?`)) {
    return
  }

  try {
    const supabase = getSupabaseClient()

    const { error } = await supabase
      .from('dates')
      .delete()
      .eq('id', idea.id)

    if (error) {
      throw new Error(error.message)
    }

    await loadIdeas()
  } catch (error) {
    loadError.value =
      error instanceof Error ? error.message : 'Could not delete date idea.'
  }
}

const planIdea = async (idea: CalendarEvent) => {
  const selectedDate = window.prompt(
    `Enter the date for "${idea.title}" (YYYY-MM-DD):`,
  )

  if (!selectedDate) {
    return
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
    loadError.value = 'Please enter the date as YYYY-MM-DD.'
    return
  }

  try {
    const supabase = getSupabaseClient()

    const { error } = await supabase
      .from('dates')
      .update({
        date: selectedDate,
        is_idea: false,
      })
      .eq('id', idea.id)

    if (error) {
      throw new Error(error.message)
    }

    await loadIdeas()
  } catch (error) {
    loadError.value =
      error instanceof Error ? error.message : 'Could not plan this date.'
  }
}

onMounted(loadIdeas)
</script>

<template>
  <div
    class="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-2 pt-2 pb-0 sm:px-4 sm:pt-4 md:px-6 md:pt-6"
  >
    <section
      class="relative flex-1 rounded-lg border border-[#d7c8b5] bg-[#fffdf8] shadow-sm shadow-stone-950/5"
    >
      <div
        class="flex items-center justify-between gap-3 border-b border-[#d7c8b5] p-3 sm:p-4"
      >
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-md border border-stone-200 text-xl text-stone-600 transition hover:border-[#bca889] hover:bg-[#f4efe6] hover:text-[#163c2f]"
          @click="emit('back')"
        >
          &lsaquo;
        </button>

        <h1 class="text-lg font-semibold text-[#16251f] sm:text-2xl">
          Date Ideas
        </h1>

        <button
          type="button"
          class="rounded-md bg-[#163c2f] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#0f2b22]"
          @click="openNewIdea"
        >
          Add Idea
        </button>
      </div>

      <div class="p-3 sm:p-4">
        <p v-if="isLoading" class="py-8 text-center text-sm text-stone-500">
          Loading ideas...
        </p>

        <p v-else-if="loadError" class="py-8 text-center text-sm text-red-700">
          {{ loadError }}
        </p>

        <p
          v-else-if="ideas.length === 0"
          class="py-12 text-center text-sm text-stone-500"
        >
          No date ideas yet.
        </p>

        <div v-else class="grid gap-3 sm:grid-cols-2">
          <article
            v-for="idea in ideas"
            :key="idea.id"
            class="rounded-lg border border-[#d7c8b5] bg-[#fffdf8] p-4 shadow-sm transition hover:border-[#bca889] hover:shadow-md"
          >
            <button
              type="button"
              class="w-full text-left"
              @click="openExistingIdea(idea)"
            >
              <h2 class="font-semibold text-[#16251f]">
                {{ idea.title }}
              </h2>

              <p
                v-if="idea.description"
                class="mt-2 text-sm leading-relaxed text-stone-600"
              >
                {{ idea.description }}
              </p>
            </button>

            <div class="mt-4 flex gap-2 border-t border-[#e3d8c9] pt-3">
              <button
                type="button"
                class="flex-1 rounded-md bg-[#163c2f] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#0f2b22]"
                @click="planIdea(idea)"
              >
                Plan this date
              </button>

              <button
                type="button"
                class="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
                @click="deleteIdea(idea)"
              >
                Delete
              </button>
            </div>
          </article>
        </div>
      </div>
    </section>
  </div>

  <div
    v-if="isModalOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/35 p-3 backdrop-blur-sm"
    @click.self="closeModal"
  >
    <section
      class="w-full rounded-lg border border-stone-200 bg-[#fffdf8] p-4 shadow-2xl shadow-stone-950/15 sm:max-w-md"
    >
      <div class="mb-4 flex items-start justify-between gap-3">
        <div>
          <p
            class="text-xs font-medium uppercase tracking-[0.16em] text-[#7a5d3b]"
          >
            Remi
          </p>

          <h2 class="mt-1 text-xl font-semibold text-[#16251f]">
            {{ editingIdea ? 'Edit date idea' : 'Add date idea' }}
          </h2>
        </div>

        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-md border border-stone-200 text-xl text-stone-500 transition hover:bg-[#f4efe6]"
          @click="closeModal"
        >
          &times;
        </button>
      </div>

      <form class="space-y-4" @submit.prevent="saveIdea">
        <label class="block">
          <span class="text-sm font-medium text-stone-700">Title</span>

          <input
            v-model="title"
            type="text"
            autocomplete="off"
            placeholder="Go camping, try a new restaurant..."
            class="mt-2 w-full rounded-md border border-stone-200 bg-white px-3 py-2.5 text-[#16251f] outline-none transition focus:border-[#6f8f7a] focus:ring-4 focus:ring-[#dfe8e1]"
          />
        </label>

        <label class="block">
          <span class="text-sm font-medium text-stone-700">
            Description
          </span>

          <textarea
            v-model="description"
            class="mt-2 min-h-32 w-full resize-y rounded-md border border-stone-200 bg-white px-3 py-2.5 text-[#16251f] outline-none transition focus:border-[#6f8f7a] focus:ring-4 focus:ring-[#dfe8e1]"
            placeholder="Add some details..."
          />
        </label>

        <p v-if="!title.trim()" class="text-sm text-stone-500">
          Title is required.
        </p>

        <div class="flex gap-3 pt-2">
          <button
            type="button"
            class="flex-1 rounded-md border border-stone-200 px-4 py-2.5 font-medium text-stone-700 transition hover:bg-[#f4efe6]"
            @click="closeModal"
          >
            Cancel
          </button>

          <button
            type="submit"
            :disabled="!title.trim() || isSaving"
            class="flex-1 rounded-md bg-[#163c2f] px-4 py-2.5 font-semibold text-white transition hover:bg-[#0f2b22] disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            {{ isSaving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>