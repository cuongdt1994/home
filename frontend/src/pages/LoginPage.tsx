import { useState, useRef, useEffect } from 'react'
import {
  Shield,
  ArrowRight,
  Smartphone,
  Key,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react'
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
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const login = useAuthStore((s) => s.login)

  // Fetch auth status hint on mount, focus first input
  useEffect(() => {
    getAuthStatus()
      .then((s) => {
        if (s?.secret_hint) setHint(s.secret_hint)
      })
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

    const filled = next.filter(Boolean).length
    if (filled === 6) {
      setTimeout(() => submit(next.join('')), 200)
    }
  }

  const handleKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) {
      refs.current[i - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus()
    }
    if (e.key === 'ArrowRight' && i < 5) {
      refs.current[i + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!p) return
    const next = [...code]
    p.split('').forEach((d, idx) => {
      if (idx < 6) next[idx] = d
    })
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
      setError('Enter your 6-digit authentication code')
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await loginWith2FA(c, true)
      setSuccess(true)
      setTimeout(() => login(data.access_token, 'admin'), 600)
    } catch (e: any) {
      setError(e.message || 'Invalid code. Please try again.')
      setCode(['', '', '', '', '', ''])
      refs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  /* ── Render ─────────────────────────── */

  const digitClass = (d: string) =>
    cn(
      'w-11 h-14 sm:w-12 sm:h-16 text-center text-xl sm:text-2xl font-bold rounded-xl border-2',
      'transition-all duration-150 outline-none bg-card',
      'focus:border-primary focus:ring-4 focus:ring-primary/10',
      'hover:border-slate-300',
      d
        ? 'border-primary bg-primary-50/50'
        : 'border-border',
      error && 'border-destructive focus:border-destructive focus:ring-destructive/10',
      success && 'border-emerald-500 bg-emerald-50',
    )

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        {/* ── Logo / Brand ────────────────── */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-5 shadow-lg shadow-primary/20">
            <Shield className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            LAN Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Sign in to your dashboard
          </p>
        </div>

        {/* ── 2FA Card ────────────────────── */}
        <Card padding="lg" className="shadow-md">
          <CardContent>
            {/* Icon + title */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-50 mb-4">
                <Smartphone className="w-6 h-6 text-primary-600" />
              </div>
              <h2 className="font-semibold text-base">Two-Factor Authentication</h2>
              <p className="text-xs text-muted-foreground mt-1.5">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            {/* Digit inputs */}
            <div
              className="flex justify-center gap-2 sm:gap-2.5 mb-5"
              onPaste={handlePaste}
            >
              {code.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    refs.current[i] = el
                  }}
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

            {/* Error message */}
            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 animate-scale-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Success message */}
            {success && (
              <div className="flex items-center justify-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 animate-scale-in">
                <Check className="w-4 h-4" />
                Verified &mdash; redirecting&hellip;
              </div>
            )}

            {/* Submit button */}
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

            {/* Footer hint */}
            <p className="text-center text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
              <Key className="w-3 h-3" />
              Open Google Authenticator or Authy
            </p>
            {hint && (
              <p className="text-center text-[11px] text-muted-foreground/50 mt-1.5 font-mono">
                Secret: &hellip;{hint}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
