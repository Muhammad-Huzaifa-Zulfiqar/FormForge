'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [msg, setMsg] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    const supabase = createClient()
    const { error } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    if (error) return setMsg(error.message)
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="mx-auto mt-24 max-w-sm p-6">
      <h1 className="mb-4 text-2xl font-semibold">
        {mode === 'login' ? 'Log in' : 'Create account'}
      </h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input className="rounded border p-2" type="email" placeholder="Email" required
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="rounded border p-2" type="password" placeholder="Password (min 6 chars)"
          required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="rounded bg-black p-2 text-white">
          {mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
      </form>
      {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}
      <button className="mt-4 text-sm underline"
        onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
      </button>
    </main>
  )
}
