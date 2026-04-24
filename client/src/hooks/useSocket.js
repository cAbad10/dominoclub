import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

export function useSocket() {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socket = io(SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id)
      setConnected(true)
    })

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected')
      setConnected(false)
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const emit = useCallback((event, data) => {
    return new Promise((resolve) => {
      if (!socketRef.current) return resolve({ ok: false, error: 'No socket' })
      socketRef.current.emit(event, data, (response) => {
        resolve(response || { ok: true })
      })
    })
  }, [])

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler)
    return () => socketRef.current?.off(event, handler)
  }, [])

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler)
  }, [])

  return { socket: socketRef.current, connected, emit, on, off }
}
