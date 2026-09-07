import type { PaintingAuthor } from '../types/painting'
import { getSupabaseClient } from './supabaseClient'

const PAINTING_VIEWER_KEY = 'remi.painting.viewer'

export type NotificationStatus =
  | 'unsupported'
  | 'install-required'
  | 'disabled'
  | 'enabled'
  | 'blocked'
  | 'loading'

interface NotificationPayload {
  type: 'painting' | 'date'
  actor?: PaintingAuthor | null
  title: string
  body: string
}

function getPublicKey() {
  return import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY
}

export function getCurrentViewer(): PaintingAuthor | null {
  const viewer = window.localStorage.getItem(PAINTING_VIEWER_KEY)
  return viewer === 'redas' || viewer === 'migle' ? viewer : null
}

export function canUsePushNotifications() {
  return Boolean(
    window.isSecureContext &&
      'Notification' in window &&
      'serviceWorker' in navigator,
  )
}

function isIosDevice() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isInstalledWebApp() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function getNotificationStatus(): NotificationStatus {
  if (
    isIosDevice() &&
    window.isSecureContext &&
    !isInstalledWebApp()
  ) {
    return 'install-required'
  }

  if (!canUsePushNotifications() || !getPublicKey()) {
    return 'unsupported'
  }

  if (Notification.permission === 'denied') {
    return 'blocked'
  }

  return Notification.permission === 'granted' ? 'enabled' : 'disabled'
}

function decodeBase64Key(value: string) {
  if (!/^[A-Za-z0-9_-]{80,90}$/.test(value)) {
    throw new Error('The VAPID public key is incomplete or contains invalid characters.')
  }

  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)

  return Uint8Array.from(rawData, (character) => character.charCodeAt(0))
}

export async function enablePushNotifications(viewer: PaintingAuthor) {
  const publicKey = getPublicKey()

  if (getNotificationStatus() === 'install-required') {
    throw new Error('On iPhone, add Remi to your Home Screen, open it there, then enable notifications.')
  }

  if (!canUsePushNotifications() || !publicKey) {
    throw new Error('Push notifications are not configured for this app yet.')
  }

  const permission = await Notification.requestPermission()

  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.')
  }

  const registration = await navigator.serviceWorker.register('/sw.js')

  if (!registration.pushManager) {
    throw new Error('Push notifications are not available in this installed browser.')
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeBase64Key(publicKey),
  })

  const { endpoint, keys } = subscription.toJSON()

  if (!endpoint || !keys?.p256dh || !keys.auth) {
    throw new Error('Could not read the phone notification subscription.')
  }

  const { error } = await getSupabaseClient().from('notification_subscriptions').upsert(
    {
      endpoint,
      viewer,
      subscription: { endpoint, keys },
    },
    { onConflict: 'endpoint' },
  )

  if (error) {
    throw new Error(error.message)
  }
}

export async function sendNotification(payload: NotificationPayload) {
  const { error } = await getSupabaseClient().functions.invoke('send-notification', {
    body: payload,
  })

  if (error) {
    console.warn('Could not send push notification.', error)
  }
}