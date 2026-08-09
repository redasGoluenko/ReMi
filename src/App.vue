<script setup lang="ts">
import { ref } from 'vue'
import CalendarView from './components/CalendarView.vue'
import PinGate from './components/PinGate.vue'
import { isPinAuthenticated, loginWithPin } from './services/pinAuth'

type PinGateExposed = {
  setError: (message: string) => void
  clearError: () => void
}

const isAuthenticated = ref(isPinAuthenticated())
const pinGateRef = ref<PinGateExposed | null>(null)

function unlockWithPin(pin: string) {
  const result = loginWithPin(pin)

  if (!result.success) {
    pinGateRef.value?.setError(result.error ?? 'Incorrect PIN.')
    return
  }

  pinGateRef.value?.clearError()
  isAuthenticated.value = true
}
</script>

<template>
  <PinGate v-if="!isAuthenticated" ref="pinGateRef" @unlock="unlockWithPin" />

  <CalendarView v-else />
</template>
