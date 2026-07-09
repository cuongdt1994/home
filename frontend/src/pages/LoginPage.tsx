import { useState, useRef, useEffect } from 'react'
import { Shield, ArrowRight, Smartphone, Key, Check, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { loginWith2FA, getAuthStatus } from '../api/auth'
import { cn } from '../lib/utils'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

export default function LoginPage() {
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [hint, setHint] = useState('')
  const [hintVisible, setHintVisible] = useState(false)
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const login = useAuthStore((s) => s.login)

  /* ── Init: fetch hint + auto-focus ───── */
  useEffect(() => {
    getAuthStatus()
      .then((s) => { if (s?.secret_hint) setHint(s.secret_hint) })
      .catch(() => {})
    refs.current[0]?.focus()
  }, [])

  /* ── Input handlers ─────────────────── */

  const handleInput = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return
    const next = [...code]
    next[i] = v.slice(-1)
    setCode(next)
    if (v && i < 5) refs.current[i + 1]?.focus()
    if (next.filter(Boolean).length === 6) {
      setTimeout(() => submit(next.join('')), 200)
    }
  }

  const handleKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) refs.current[i - 1]?.focus()
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!p) return
    const next = [...code]
    p.split('').forEach((d, idx) => { if (idx < 6) next[idx] = d })
    setCode(next)
    if (p.length === 6) {
      setTimeout(() => submit(p), 200)
    } else {
      refs.current[Math.min(p.length, 5)]?.focus()
    }
  }

  /* ── Submit ─────────────────────────── */

  const submit = async (override?: string) => {
    const c = override || code.join('')
    if (c.length < 4) {
      setError('Please enter the 6-digit authentication code')
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await loginWith2FA(c, true)
      setSuccess(true)
      setTimeout(() => login(data.access_token, 'admin'), 700)
    } catch (e: any) {
      setError(e.message || 'Invalid code. Please try again.')
      setCode(['', '', '', '', '', ''])
      refs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  /* ── Digit input style ──────────────── */

  const digitClass = (d: string) =>
    cn(
      'w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl sm:text-3xl font-semibold rounded-xl border-2',
      'transition-all duration-200 bg-card outline-none',
      'focus:border-accent focus:ring-2 focus:ring-accent/25',
      'hover:border-zinc-600',
      d
        ? 'border-accent bg-accent/10'
        : 'border-border',
      error && 'border-destructive focus:border-destructive focus:ring-destructive/25',
      success && 'border-green-500 bg-green-500/10',
    )

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-[420px]">
        {/* ── Logo / Brand ────────────────── */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent mb-6 shadow-xl shadow-accent/25">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            LAN Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Sign in to your dashboard
          </p>
        </div>

        {/* ── 2FA Card (glass) ────────────── */}
        <Card padding="lg" glass className="shadow-xl">
          <CardContent>
            {/* Header */}
            <div className="text-center mb-7">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent/15 mb-4">
                <Smartphone className="w-6 h-6 text-accent-400" />
              </div>
              <h2 className="font-semibold text-base text-foreground">
                Two-Factor Authentication
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            {/* Digit inputs */}
            <div className="flex justify-center gap-2.5 sm:gap-3 mb-5" onPaste={handlePaste}>
              {code.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { refs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  autoComplete="one-time-code"
                  onChange={(e) => handleInput(i, e.target.value)}
                  onKeyDown={(e) => handleKey(i, e)}
                  className={digitClass(d)}
                  disabled={loading || success}
                  aria-label={`Digit ${i + 1}`}
                />
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4 animate-scale-in">
                <AlertCircle className="w-[18px] h-[18px] shrink-0 mt-px" />
                <span>{error}</span>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="flex items-center justify-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 mb-4 animate-scale-in">
                <Check className="w-[18px] h-[18px]" />
                Verified — redirecting...
              </div>
            )}

            {/* Submit */}
            <Button
              onClick={() => submit()}
              disabled={loading || success || code.join('').length < 4}
              loading={loading}
              className="w-full"
              size="lg"
            >
              {!loading && (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
              {loading && 'Verifying...'}
            </Button>

            {/* Hint — collapsible, muted */}
            <div className="mt-5 pt-4 border-t border-border">
              <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                <Key className="w-3.5 h-3.5" />
                Open Google Authenticator or Authy
              </p>

              {hint && (
                <div className="mt-3 text-center">
                  <button
                    onClick={() => setHintVisible(!hintVisible)}
                    className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors underline underline-offset-2"
                  >
                    {hintVisible ? 'Hide' : 'Show'} secret key
                  </button>
                  {hintVisible && (
                    <p className="text-[11px] text-zinc-600 mt-1.5 font-mono bg-muted rounded-lg py-1.5 px-3 inline-block animate-scale-in">
                      &hellip;{hint}
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
