<script setup lang="ts">
import { computed, ref } from 'vue'

const emit = defineEmits<{
  unlock: [pin: string]
}>()

const pin = ref('')
const errorMessage = ref('')

const maskedPin = computed(() => pin.value.replace(/\D/g, '').slice(0, 4))
const canSubmit = computed(() => maskedPin.value.length === 4)

function handleInput(event: Event) {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  pin.value = target.value.replace(/\D/g, '').slice(0, 4)
}

function setError(message: string) {
  errorMessage.value = message
}

function clearError() {
  errorMessage.value = ''
}

function submitPin() {
  if (!canSubmit.value) {
    setError('Please enter all 4 digits.')
    return
  }

  clearError()
  emit('unlock', maskedPin.value)
}

defineExpose({
  setError,
  clearError,
})
</script>

<template>
  <main class="min-h-screen bg-[#f7f5ef] text-[#16251f]">
    <div class="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-8 sm:px-6">
      <section class="w-full rounded-lg border border-[#d7c8b5] bg-[#fffdf8] p-6 shadow-xl shadow-stone-950/10 sm:p-8">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a5d3b]">Remi</p>
        <h1 class="mt-2 text-3xl font-semibold text-[#163c2f] sm:text-4xl">Enter Couple PIN</h1>
        <p class="mt-3 text-sm text-stone-600 sm:text-base">
          Enter your shared 4-digit PIN to open your calendar.
        </p>

        <form class="mt-6 space-y-4" @submit.prevent="submitPin">
          <label class="block">
            <span class="text-sm font-medium text-stone-700">4-digit PIN</span>
            <input
              :value="pin"
              inputmode="numeric"
              maxlength="4"
              type="password"
              autocomplete="off"
              class="mt-2 w-full rounded-md border border-stone-200 bg-white px-3 py-3 text-lg tracking-[0.35em] text-[#16251f] outline-none transition placeholder:tracking-normal placeholder:text-stone-400 focus:border-[#6f8f7a] focus:ring-4 focus:ring-[#dfe8e1]"
              placeholder="0000"
              aria-label="Couple PIN"
              @input="handleInput"
            />
          </label>

          <p v-if="errorMessage" class="text-sm font-medium text-red-700">{{ errorMessage }}</p>

          <button
            type="submit"
            class="w-full rounded-md bg-[#163c2f] px-4 py-3 font-semibold text-white transition hover:bg-[#0f2b22] focus:outline-none focus:ring-2 focus:ring-[#9fb5a9] disabled:cursor-not-allowed disabled:bg-stone-300"
            :disabled="!canSubmit"
          >
            Unlock Calendar
          </button>
        </form>
      </section>
    </div>
  </main>
</template>
