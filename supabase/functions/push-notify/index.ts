import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import webpush from "https://esm.sh/web-push@3.6.7"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  let phone: string, title: string, body: string, action_url: string
  try {
    const payload = await req.json()
    phone = payload.phone
    title = payload.title || "Ambria Calendar"
    body = payload.body || ""
    action_url = payload.action_url || "/"
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  if (!phone) {
    return new Response(JSON.stringify({ error: "phone is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const vapidSubject = Deno.env.get("VAPID_SUBJECT")!
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  const { data: subscriptions, error: fetchError } = await supabase
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("phone", phone)

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  if (!subscriptions || subscriptions.length === 0) {
    return new Response(
      JSON.stringify({ sent: 0, failed: 0, expired_cleaned: 0, message: "No subscriptions found" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }

  let sent = 0
  let failed = 0
  let expired_cleaned = 0
  const notificationPayload = JSON.stringify({ title, body, action_url })

  await Promise.all(
    subscriptions.map(async (row: { id: string; subscription: any }) => {
      try {
        await webpush.sendNotification(row.subscription, notificationPayload)
        sent++
      } catch (err: any) {
        const statusCode = err?.statusCode ?? err?.status
        if (statusCode === 410 || statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", row.id)
          expired_cleaned++
        } else {
          failed++
        }
      }
    }),
  )

  return new Response(
    JSON.stringify({ sent, failed, expired_cleaned }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  )
})
