import { supabase } from './supabase.js'

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function subscribeToPush(phone) {
  if (!isPushSupported()) return { success: false, reason: 'unsupported' }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { success: false, reason: 'denied' }

    const registration = await navigator.serviceWorker.ready
    const applicationServerKey = urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY)
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })

    const subJson = subscription.toJSON()
    const { error } = await supabase
      .from('push_subscriptions')
      .insert({ phone, subscription: subJson })

    if (error && !error.message?.includes('duplicate') && !error.message?.includes('unique')) {
      throw error
    }

    return { success: true }
  } catch (err) {
    console.error('[push] subscribe failed', err)
    return { success: false, reason: 'error' }
  }
}
