import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { HONEYPOT_FIELD, isHoneypotTripped, hashIp, verifyRecaptcha } from '@/lib/spam'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: CORS })

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = createAdminClient()

  // 1. Find the form
  const { data: form } = await db
    .from('forms')
    .select('id, owner_id, recaptcha_on, allowed_domain')
    .eq('id', id)
    .single()
  if (!form) return json({ error: 'Form not found' }, 404)

  // 2. Optional domain allow-list
  if (form.allowed_domain) {
    const source = req.headers.get('origin') ?? req.headers.get('referer') ?? ''
    let host = ''
    try { host = new URL(source).hostname } catch {}
    if (host !== form.allowed_domain) return json({ error: 'Domain not allowed' }, 403)
  }

  // 3. Parse body (HTML form-encoded or JSON)
  let body: Record<string, unknown> = {}
  try {
    if ((req.headers.get('content-type') ?? '').includes('application/json')) {
      body = await req.json()
    } else {
      const fd = await req.formData()
      body = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string'))
    }
  } catch {
    return json({ error: 'Invalid body' }, 400)
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const ipHash = hashIp(ip)

  const data = { ...body }
  for (const k of [HONEYPOT_FIELD, 'g-recaptcha-response', '_redirect']) delete data[k]

  // 4. Honeypot: save as spam, but reply "ok" so bots don't adapt
  if (isHoneypotTripped(body)) {
    await db.from('submissions').insert({ form_id: id, data, is_spam: true, ip_hash: ipHash })
    return json({ ok: true })
  }

  // 5. Rate limit: max 5 per minute per IP per form
  const since = new Date(Date.now() - 60_000).toISOString()
  const { count: recent } = await db
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('form_id', id)
    .eq('ip_hash', ipHash)
    .gte('created_at', since)
  if ((recent ?? 0) >= 5) return json({ error: 'Too many submissions' }, 429)

  // 6. reCAPTCHA (only if the owner turned it on)
  if (form.recaptcha_on && !(await verifyRecaptcha(body['g-recaptcha-response']))) {
    return json({ error: 'reCAPTCHA failed' }, 400)
  }

  // 7. Monthly quota (free plan = 50)
  const { data: sub } = await db
    .from('subscriptions')
    .select('monthly_quota')
    .eq('user_id', form.owner_id)
    .maybeSingle()
  const quota = sub?.monthly_quota ?? 50
  const { data: ownerForms } = await db.from('forms').select('id').eq('owner_id', form.owner_id)
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const { count: used } = await db
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .in('form_id', (ownerForms ?? []).map((f) => f.id))
    .eq('is_spam', false)
    .gte('created_at', monthStart.toISOString())
  if ((used ?? 0) >= quota) return json({ error: 'Monthly quota reached' }, 402)

  // 8. Save
  const { error } = await db
    .from('submissions')
    .insert({ form_id: id, data, is_spam: false, ip_hash: ipHash })
  if (error) return json({ error: 'Could not save submission' }, 500)

  // 9. Redirect back to the site if requested, else JSON
  const redirectTo = typeof body._redirect === 'string' ? body._redirect : null
  if (redirectTo && /^https?:\/\//.test(redirectTo)) {
    return NextResponse.redirect(redirectTo, 303)
  }
  return json({ ok: true })
}
