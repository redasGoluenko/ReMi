const AUTH_STORAGE_KEY = 'remi.pin-authenticated'
const COUPLE_PIN = '0711'

export interface PinLoginResult {
  success: boolean
  error?: string
}

export function isPinAuthenticated(): boolean {
  return window.localStorage.getItem(AUTH_STORAGE_KEY) === 'true'
}

export function loginWithPin(pin: string): PinLoginResult {
  if (!/^\d{4}$/.test(pin)) {
    return { success: false, error: 'Please enter a 4-digit PIN.' }
  }

  if (pin !== COUPLE_PIN) {
    return { success: false, error: 'Incorrect PIN. Please try again.' }
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, 'true')
  return { success: true }
}

export function logoutPinAuth() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
}
