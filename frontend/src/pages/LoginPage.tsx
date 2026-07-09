import { useState, useRef, useEffect } from 'react'
import { Shield, ArrowRight, Smartphone, Key, Check, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { loginWith2FA, getAuthStatus } from '../api/auth'
import { cn } from '../lib/utils'

export default function LoginPage() {
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [hint, setHint] = useState('')
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const login = useAuthStore((s) => s.login)

  useEffect(() => {
    getAuthStatus().then(s => { if (s?.secret_hint) setHint(s.secret_hint) }).catch(() => {})
    refs.current[0]?.focus()
  }, [])

  const handleInput = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return
    const next = [...code]; next[i] = v.slice(-1); setCode(next)
    if (v && i < 5) refs.current[i + 1]?.focus()
    const filled = next.filter(Boolean).length
    if (filled === 6) setTimeout(() => submit(next.join('')), 200)
  }

  const handleKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) refs.current[i - 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!p) return
    const next = [...code]; p.split('').forEach((d, i) => { if (i < 6) next[i] = d })
    setCode(next)
    p.length === 6 ? setTimeout(() => submit(p), 200) : refs.current[Math.min(p.length, 5)]?.focus()
  }

  const submit = async (override?: string) => {
    const c = override || code.join('')
    if (c.length < 4) { setError('Enter your 6-digit authentication code'); return }
    setError(''); setLoading(true)
    try {
      const data = await loginWith2FA(c, true)
      setSuccess(true)
      setTimeout(() => login(data.access_token, 'admin'), 600)
    } catch (e: any) {
      setError(e.message || 'Invalid code. Please try again.')
      setCode(['', '', '', '', '', ''])
      refs.current[0]?.focus()
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-4">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">LAN Monitor</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your dashboard</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-accent mb-3">
              <Smartphone className="w-5 h-5 text-foreground" />
            </div>
            <h2 className="font-semibold text-sm">Two-Factor Authentication</h2>
            <p className="text-xs text-muted-foreground mt-1">Enter code from your authenticator app</p>
          </div>

          {/* Inputs */}
          <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
            {code.map((d, i) => (
              <input
                key={i}
                ref={el => { refs.current[i] = el }}
                type="text" inputMode="numeric" maxLength={1} value={d} autoComplete="one-time-code"
                onChange={e => handleInput(i, e.target.value)}
                onKeyDown={e => handleKey(i, e)}
                className={cn(
                  'w-11 h-14 text-center text-xl font-bold rounded-lg border-2 transition-all outline-none',
                  d ? 'border-primary bg-primary/5' : 'border-input bg-transparent',
                  error && 'border-destructive bg-destructive/5',
                  success && 'border-green-500 bg-green-50'
                )}
                disabled={loading || success}
              />
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {success && (
            <div className="flex items-center justify-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
              <Check className="w-4 h-4" /> Verified — redirecting...
            </div>
          )}

          <button onClick={() => submit()}
            disabled={loading || success || code.join('').length < 4}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-all">
            {loading ? (
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <>Sign in <ArrowRight className="w-4 h-4" /></>
            )}
          </button>

          <p className="text-center text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1">
            <Key className="w-3 h-3" /> Open Google Authenticator or Authy
          </p>
          {hint && <p className="text-center text-[10px] text-muted-foreground/60 mt-1">Secret: ...{hint}</p>}
        </div>
      </div>
    </div>
  )
}
