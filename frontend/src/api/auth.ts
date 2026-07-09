const BASE = '/api/auth'

export async function loginWith2FA(code: string, remember = false) {
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, remember }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Invalid 2FA code' }))
    throw new Error(err.detail || 'Invalid 2FA code')
  }
  return res.json()
}

export async function logoutApi() {
  await fetch(`${BASE}/logout`, { method: 'POST' }).catch(() => {})
}

export async function getAuthStatus() {
  const res = await fetch(`${BASE}/status`)
  return res.json()
}

export async function getMeApi(token: string) {
  const res = await fetch(`${BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Not authenticated')
  return res.json()
}

export async function getTotpSecret(token: string) {
  const res = await fetch(`${BASE}/secret`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to get secret')
  return res.json()
}
