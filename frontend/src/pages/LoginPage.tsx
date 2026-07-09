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
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const login = useAuthStore((s) => s.login)

  useEffect(() => {
    getAuthStatus()
      .then((s) => { if (s?.secret_hint) setHint(s.secret_hint) })
      .catch(() => {})
    refs.current[0]?.focus()
  }, [])

  /* ── Input handlers ─────────────────── */

  const handleInput = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return
    const n = [...code]; n[i] = v.slice(-1); setCode(n)
    if (v && i < 5) refs.current[i + 1]?.focus()
    if (n.filter(Boolean).length === 6) setTimeout(() => submit(n.join('')), 200)
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
    const n = [...code]; p.split('').forEach((d, idx) => { if (idx < 6) n[idx] = d })
    setCode(n)
    p.length === 6 ? setTimeout(() => submit(p), 200) : refs.current[Math.min(p.length, 5)]?.focus()
  }

  /* ── Submit ─────────────────────────── */

  const submit = async (override?: string) => {
    const c = override || code.join('')
    if (c.length < 4) { setError('Vui lòng nhập mã 6 chữ số'); return }
    setError(''); setLoading(true)
    try {
      const data = await loginWith2FA(c, true)
      setSuccess(true)
      setTimeout(() => login(data.access_token, 'admin'), 700)
    } catch (e: any) {
      setError(e.message || 'Mã không đúng. Vui lòng thử lại.')
      setCode(['', '', '', '', '', ''])
      refs.current[0]?.focus()
    } finally { setLoading(false) }
  }

  /* ── Digit input style ──────────────── */

  const digitClass = (d: string) =>
    cn(
      'w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl sm:text-3xl font-semibold rounded-2xl border-2',
      'transition-all duration-200 ease-out bg-white outline-none',
      'focus:border-apple-blue focus:shadow-[0_0_0_4px_rgba(0,113,227,0.12)]',
      'hover:border-apple-border',
      d
        ? 'border-apple-blue bg-[#e8f4fd]'
        : 'border-apple-border-light',
      error && 'border-apple-red focus:border-apple-red focus:shadow-[0_0_0_4px_rgba(255,59,48,0.12)]',
      success && 'border-apple-green bg-[#e8f8ee]',
    )

  return (
    <div className="min-h-screen flex items-center justify-center bg-apple-bg p-4">
      <div className="w-full max-w-[400px]">
        {/* ── Logo ────────────────────────── */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-apple-blue mb-6 shadow-xl shadow-apple-blue/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-[28px] font-semibold tracking-tight text-apple-text">
            LAN Monitor
          </h1>
          <p className="text-[15px] text-apple-text-secondary mt-2 font-normal">
            Đăng nhập vào bảng điều khiển
          </p>
        </div>

        {/* ── 2FA Card ────────────────────── */}
        <Card padding="xl" glass className="shadow-lg">
          <CardContent>
            <div className="text-center mb-7">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#e8f4fd] mb-5">
                <Smartphone className="w-7 h-7 text-apple-blue" />
              </div>
              <h2 className="font-semibold text-[17px] text-apple-text">
                Xác thực hai lớp
              </h2>
              <p className="text-[14px] text-apple-text-secondary mt-1.5">
                Nhập mã 6 chữ số từ ứng dụng Authenticator
              </p>
            </div>

            {/* Digits */}
            <div className="flex justify-center gap-2.5 sm:gap-3 mb-6" onPaste={handlePaste}>
              {code.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { refs.current[i] = el }}
                  type="text" inputMode="numeric" maxLength={1} value={d}
                  autoComplete="one-time-code"
                  onChange={(e) => handleInput(i, e.target.value)}
                  onKeyDown={(e) => handleKey(i, e)}
                  className={digitClass(d)}
                  disabled={loading || success}
                  aria-label={`Chữ số ${i + 1}`}
                />
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 text-[14px] text-apple-red bg-[#fde8e8] rounded-2xl px-4 py-3.5 mb-5 animate-scale-in">
                <AlertCircle className="w-[18px] h-[18px] shrink-0 mt-px" />
                <span>{error}</span>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="flex items-center justify-center gap-2 text-[14px] text-[#248a3d] bg-[#e8f8ee] rounded-2xl px-4 py-3.5 mb-5 animate-scale-in">
                <Check className="w-[18px] h-[18px]" />
                Xác thực thành công — đang chuyển hướng...
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
                  Đăng nhập
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
              {loading && 'Đang xác thực...'}
            </Button>

            {/* Hint */}
            <p className="text-center text-[13px] text-apple-text-secondary mt-5 flex items-center justify-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              Mở Google Authenticator hoặc Authy
            </p>
            {hint && (
              <p className="text-center text-[12px] text-apple-text-tertiary mt-2 font-mono">
                Secret: &hellip;{hint}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
