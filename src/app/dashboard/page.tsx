import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function createForm(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  await supabase.from('forms').insert({ owner_id: user.id, name, notify_email: user.email })
  revalidatePath('/dashboard')
}

async function signOut() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

async function DashboardContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login') // authentication gate

  const { data: forms } = await supabase
    .from('forms')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My forms</h1>
        <form action={signOut}><button className="text-sm underline">Sign out ({user.email})</button></form>
      </div>
      <form action={createForm} className="mb-6 flex gap-2">
        <input name="name" required placeholder="New form name" className="flex-1 rounded border p-2" />
        <button className="rounded bg-black px-4 text-white">Create</button>
      </form>
      <ul className="flex flex-col gap-3">
        {(forms ?? []).map((f) => (
          <li key={f.id} className="rounded border p-3">
            <div className="font-medium">{f.name}</div>
            <code className="text-xs break-all">{base}/f/{f.id}</code>
          </li>
        ))}
        {(forms ?? []).length === 0 && <li className="text-sm text-gray-500">No forms yet.</li>}
      </ul>
    </main>
  )
}

export default function Dashboard() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-2xl p-6 text-sm text-gray-500">Loading...</main>}>
      <DashboardContent />
    </Suspense>
  )
}