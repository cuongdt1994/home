import { useEffect, useRef, useCallback, useState } from 'react'
import type { WSMessage } from '../types'

type MessageHandler = (msg: WSMessage) => void

export function useWebSocket(onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host

    try {
      const ws = new WebSocket(`${protocol}//${host}/api/ws`)
      wsRef.current = ws
      setStatus('connecting')

      ws.onopen = () => {
        setStatus('connected')
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      }

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data)
          onMessage(msg)
        } catch {}
      }

      ws.onclose = () => {
        setStatus('disconnected')
        wsRef.current = null
        reconnectTimer.current = setTimeout(connect, 5000)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {
      reconnectTimer.current = setTimeout(connect, 5000)
    }
  }, [onMessage])

  useEffect(() => {
    connect()
    // Heartbeat ping
    const ping = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping')
      }
    }, 30000)

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      clearInterval(ping)
      wsRef.current?.close()
    }
  }, [connect])

  return { status }
}
