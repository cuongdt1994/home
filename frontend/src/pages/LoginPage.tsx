import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Wifi, Shield, ArrowRight, Smartphone, Key, Check, AlertCircle } from 'lucide-react'
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
    // Focus first input
    inputRefs.current[0]?.focus()
  }, [])

  const handleInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return // Only digits

    const newCode = [...code]
    newCode[index] = value.slice(-1) // Take only last digit
    setCode(newCode)

    // Auto advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // If all digits filled, auto-submit
    if (index === 5 && value) {
      const finalCode = newCode.join('') + ''
      if (finalCode.length === 6) {
        setTimeout(() => handleSubmit(finalCode), 200)
      }
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length > 0) {
      const newCode = [...code]
      pasted.split('').forEach((digit, i) => {
        if (i < 6) newCode[i] = digit
      })
      setCode(newCode)
      if (pasted.length === 6) {
        setTimeout(() => handleSubmit(pasted), 200)
      } else {
        inputRefs.current[Math.min(pasted.length, 5)]?.focus()
      }
    }
  }

  const handleSubmit = async (overrideCode?: string) => {
    const finalCode = overrideCode || code.join('')
    if (finalCode.length < 4) {
      setError('Please enter your 6-digit 2FA code')
      return
    }

    setError('')
    setLoading(true)
    try {
      const data = await loginWith2FA(finalCode, true)
      setSuccess(true)
      setTimeout(() => {
        login(data.access_token, 'admin')
      }, 600)
    } catch (err: any) {
      setError(err.message || 'Invalid code')
      // Clear inputs on error
      setCode(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            animate={success ? { scale: [1, 1.1, 1] } : {}}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary-500 shadow-lg mb-4"
          >
            {success ? (
              <Check className="w-10 h-10 text-white" />
            ) : (
              <Shield className="w-10 h-10 text-white" />
            )}
          </motion.div>
          <h1 className="text-2xl font-bold text-surface-900">LAN Monitor</h1>
          <p className="text-surface-500 mt-1">Network Security Dashboard</p>
        </div>

        {/* Login form */}
        <motion.form
          onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
          className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-5"
        >
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-purple-50 mb-3">
              <Smartphone className="w-6 h-6 text-purple-500" />
            </div>
            <h2 className="font-semibold text-surface-900 text-lg">Xác thực 2 lớp (2FA)</h2>
            <p className="text-sm text-surface-500 mt-1">
              Nhập mã 6 chữ số từ ứng dụng Authenticator
            </p>
          </div>

          {/* 2FA code inputs */}
          <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleInput(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={cn(
                  'w-12 h-14 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-bold rounded-xl border-2 transition-all',
                  'focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400',
                  digit
                    ? 'border-primary-300 bg-primary-50 text-primary-700'
                    : 'border-surface-200 bg-white text-surface-900',
                  error && 'border-red-300',
                  success && 'border-green-300 bg-green-50'
                )}
                disabled={loading || success}
                autoComplete="one-time-code"
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}

          {/* Success */}
          {success && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-2 bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl border border-green-200"
            >
              <Check className="w-4 h-4" />
              Đăng nhập thành công!
            </motion.div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading || success || code.join('').length < 4}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all',
              'bg-primary-500 text-white hover:bg-primary-600 shadow-sm hover:shadow-md',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Xác thực
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Hint */}
          <div className="text-center pt-2">
            <div className="flex items-center justify-center gap-1.5 text-xs text-surface-400">
              <Key className="w-3 h-3" />
              <span>
                Mở Google Authenticator / Authy → nhập mã 6 chữ số
              </span>
            </div>
            {secretHint && (
              <p className="text-[10px] text-surface-300 mt-1">
                Secret hint: ...{secretHint}
              </p>
            )}
          </div>
        </motion.form>

        <p className="text-xs text-surface-400 text-center mt-6">
          🔒 Bảo vệ bởi xác thực 2 lớp TOTP
        </p>
      </motion.div>
    </div>
  )
}
