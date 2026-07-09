import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Shield, ArrowRight, Smartphone, Key, Check, AlertCircle, Activity, Wifi, Server } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { loginWith2FA, getAuthStatus } from '../api/auth'
import { cn } from '../lib/utils'

export default function LoginPage() {
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [secretHint, setSecretHint] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const login = useAuthStore((s) => s.login)

  useEffect(() => {
    getAuthStatus().then(s => {
      if (s?.secret_hint) setSecretHint(s.secret_hint)
    }).catch(() => {})
    inputRefs.current[0]?.focus()
  }, [])

  const handleInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newCode = [...code]
    newCode[index] = value.slice(-1)
    setCode(newCode)
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
    const filled = newCode.filter(Boolean).length + (index === 5 && value ? 1 : 0)
    if (filled >= 6) setTimeout(() => handleSubmit(newCode.join('')), 200)
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) inputRefs.current[index - 1]?.focus()
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const newCode = [...code]
    pasted.split('').forEach((d, i) => { if (i < 6) newCode[i] = d })
    setCode(newCode)
    pasted.length === 6 ? setTimeout(() => handleSubmit(pasted), 200) : inputRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  const handleSubmit = async (overrideCode?: string) => {
    const finalCode = overrideCode || code.join('')
    if (finalCode.length < 4) { setError('Please enter your 6-digit 2FA code'); return }
    setError(''); setLoading(true)
    try {
      const data = await loginWith2FA(finalCode, true)
      setSuccess(true)
      setTimeout(() => login(data.access_token, 'admin'), 800)
    } catch (err: any) {
      setError(err.message || 'Invalid code')
      setCode(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 30%, #172554 60%, #0f172a 100%)' }}>
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl animate-float" />
        <div className="absolute top-1/2 -right-40 w-80 h-80 bg-violet-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute -bottom-40 left-1/3 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-[440px]">

        {/* Logo */}
        <div className="text-center mb-10">
          <motion.div animate={success ? { scale: [1, 1.15, 1] } : {}} transition={{ duration: 0.4 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-5"
            style={{ background: 'linear-gradient(135deg, #5c7cfa, #8b5cf6)' }}>
            {success ? <Check className="w-10 h-10 text-white" /> : <Shield className="w-10 h-10 text-white" />}
          </motion.div>
          <h1 className="text-3xl font-bold text-white tracking-tight">LAN Monitor</h1>
          <p className="text-slate-400 mt-2 text-sm">Network Security Dashboard</p>
        </div>

        {/* Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
          className="bg-white/10 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">

          {/* Icon */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-500/20 mb-4">
              <Smartphone className="w-7 h-7 text-brand-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Two-Factor Authentication</h2>
            <p className="text-slate-400 text-sm mt-1.5">Enter the 6-digit code from your authenticator app</p>
          </div>

          {/* Code inputs */}
          <div className="flex justify-center gap-2.5 sm:gap-3 mb-6" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el }}
                type="text" inputMode="numeric" maxLength={1} value={digit} autoComplete="one-time-code"
                onChange={(e) => handleInput(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={cn(
                  'w-12 h-16 sm:w-14 sm:h-18 text-center text-2xl font-bold rounded-2xl border-2 transition-all duration-200 outline-none',
                  digit
                    ? 'border-brand-400/60 bg-brand-500/10 text-white shadow-lg shadow-brand-500/20'
                    : 'border-white/10 bg-white/5 text-white',
                  error && 'border-rose-500/60 bg-rose-500/10',
                  success && 'border-emerald-500/60 bg-emerald-500/10'
                )}
                disabled={loading || success}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm px-4 py-3 rounded-2xl mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </motion.div>
          )}

          {/* Success */}
          {success && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm px-4 py-3 rounded-2xl mb-4">
              <Check className="w-4 h-4" /> Authenticated — redirecting...
            </motion.div>
          )}

          {/* Submit */}
          <button type="button" onClick={() => handleSubmit()}
            disabled={loading || success || code.join('').length < 4}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-300',
              'bg-white text-slate-900 hover:bg-slate-100 shadow-lg shadow-white/10',
              'disabled:opacity-30 disabled:cursor-not-allowed'
            )}>
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-400 border-t-slate-900 rounded-full animate-spin" />
            ) : (
              <>Verify Identity<ArrowRight className="w-4 h-4" /></>
            )}
          </button>

          {/* Hint */}
          <div className="text-center mt-5">
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
              <Key className="w-3 h-3" />
              <span>Open Google Authenticator or Authy</span>
            </div>
            {secretHint && <p className="text-[10px] text-slate-600 mt-1">Secret ends with ...{secretHint}</p>}
          </div>
        </motion.div>

        {/* Bottom features */}
        <div className="grid grid-cols-3 gap-3 mt-8">
          {[
            { icon: Activity, label: 'Real-time IDS', color: 'text-brand-400' },
            { icon: Wifi, label: 'Traffic Monitor', color: 'text-cyan-400' },
            { icon: Server, label: 'Router Control', color: 'text-violet-400' },
          ].map((f, i) => (
            <div key={i} className="text-center group">
              <f.icon className={cn('w-5 h-5 mx-auto mb-1 transition-transform group-hover:scale-110', f.color)} />
              <p className="text-[10px] text-slate-500">{f.label}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
