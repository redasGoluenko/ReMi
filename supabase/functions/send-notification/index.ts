import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationRequest {
  type: 'painting' | 'date'
  actor?: 'redas' | 'migle' | null
  title: string
  body: string
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:notifications@example.com'

    if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
      return jsonResponse({ error: 'Notification server is not configured.' }, 500)
    }

    const payload = (await request.json()) as NotificationRequest

    if (!payload.title || !payload.body || !['painting', 'date'].includes(payload.type)) {
      return jsonResponse({ error: 'Invalid notification payload.' }, 400)
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    const subscriptionsResponse = await fetch(
      `${supabaseUrl}/rest/v1/notification_subscriptions?select=endpoint,viewer,subscription`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
    )

    if (!subscriptionsResponse.ok) {
      throw new Error(await subscriptionsResponse.text())
    }

    const subscriptions = (await subscriptionsResponse.json()) as Array<{
      endpoint: string
      viewer: 'redas' | 'migle'
      subscription: webpush.PushSubscription
    }>

    const notification = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: '/',
    })

    await Promise.all(
      subscriptions
        .filter((subscription) => subscription.viewer !== payload.actor)
        .map(async (subscription) => {
          try {
            await webpush.sendNotification(subscription.subscription, notification)
          } catch (error) {
            const statusCode = (error as { statusCode?: number }).statusCode

            if (statusCode === 404 || statusCode === 410) {
              await fetch(
                `${supabaseUrl}/rest/v1/notification_subscriptions?endpoint=eq.${encodeURIComponent(subscription.endpoint)}`,
                {
                  method: 'DELETE',
                  headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
                },
              )
            }
          }
        }),
    )

    return jsonResponse({ sent: true })
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error.' }, 500)
  }
})