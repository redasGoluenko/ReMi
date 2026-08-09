<script setup lang="ts">
import { computed, ref } from 'vue'

const emit = defineEmits<{
  unlock: [pin: string]
}>()

const pinDigits = ref(['', '', '', ''])
const pinInputs = ref<HTMLInputElement[]>([])
const errorMessage = ref('')

const maskedPin = computed(() => pinDigits.value.join(''))
const canSubmit = computed(() => maskedPin.value.length === 4)

function registerPinInput(element: HTMLInputElement | null, index: number) {
  if (!element) {
    return
  }

  pinInputs.value[index] = element
}

function focusInput(index: number) {
  pinInputs.value[index]?.focus()
  pinInputs.value[index]?.select()
}

function tryAutoSubmit() {
  if (canSubmit.value) {
    submitPin()
  }
}

function handleInput(event: Event, index: number) {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  const nextValue = target.value.replace(/\D/g, '')

  if (nextValue.length > 1) {
    for (let i = 0; i < 4; i += 1) {
      pinDigits.value[i] = nextValue[i] ?? ''
    }

    clearError()

    if (pinDigits.value[3]) {
      tryAutoSubmit()
      return
    }

    focusInput(Math.min(nextValue.length, 3))
    return
  }

  pinDigits.value[index] = nextValue
  clearError()

  if (nextValue && index < 3) {
    focusInput(index + 1)
  }

  tryAutoSubmit()
}

function handleKeydown(event: KeyboardEvent, index: number) {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  if (event.key === 'Backspace' && !target.value && index > 0) {
    pinDigits.value[index - 1] = ''
    focusInput(index - 1)
    clearError()
  }
}

function handlePaste(event: ClipboardEvent) {
  const pasted = event.clipboardData?.getData('text')?.replace(/\D/g, '').slice(0, 4) ?? ''

  if (!pasted) {
    return
  }

  event.preventDefault()

  for (let i = 0; i < 4; i += 1) {
    pinDigits.value[i] = pasted[i] ?? ''
  }

  clearError()

  if (pinDigits.value[3]) {
    tryAutoSubmit()
    return
  }

  focusInput(Math.min(pasted.length, 3))
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
            <div class="mt-2 grid grid-cols-4 gap-3" role="group" aria-label="Couple PIN">
              <input
                v-for="(_, index) in pinDigits"
                :key="index"
                :ref="(element) => registerPinInput(element as HTMLInputElement | null, index)"
                :value="pinDigits[index]"
                type="password"
                inputmode="numeric"
                autocomplete="off"
                maxlength="1"
                class="h-14 w-full rounded-md border border-stone-200 bg-white text-center text-2xl font-semibold text-[#16251f] outline-none transition focus:border-[#6f8f7a] focus:ring-4 focus:ring-[#dfe8e1]"
                :aria-label="`PIN digit ${index + 1}`"
                @input="handleInput($event, index)"
                @keydown="handleKeydown($event, index)"
                @paste="handlePaste"
              />
            </div>
          </label>

          <p v-if="errorMessage" class="text-sm font-medium text-red-700">{{ errorMessage }}</p>

          <p class="text-xs text-stone-500">Calendar unlocks automatically after the 4th digit.</p>
        </form>
      </section>
    </div>
  </main>
</template>
