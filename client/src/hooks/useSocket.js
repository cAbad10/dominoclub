import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

export function useSocket() {
  const socketRef = useRef(null)
  const listenersRef = useRef([]) // queue listeners registered before socket ready
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let socket
    try {
      socket = io(SERVER_URL, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1500,
        timeout: 10000,
      })
    } catch (err) {
      console.warn('[Socket] Failed to initialise:', err)
      return
    }

    socketRef.current = socket

    // Flush any listeners that were registered before the socket was ready
    listenersRef.current.forEach(({ event, handler }) => {
      socket.on(event, handler)
    })
    listenersRef.current = []

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id)
      setConnected(true)
    })

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message)
      setConnected(false)
    })

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
      setConnected(false)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  // emit — always returns a Promise, never throws
  const emit = useCallback((event, data) => {
    return new Promise((resolve) => {
      if (!socketRef.current?.connected) {
        return resolve({ ok: false, error: 'Not connected to server' })
      }
      try {
        socketRef.current.emit(event, data, (response) => {
          resolve(response || { ok: true })
        })
      } catch (err) {
        resolve({ ok: false, error: err.message })
      }
    })
  }, [])

  // on — safe to call before socket is ready; queues if needed
  const on = useCallback((event, handler) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler)
    } else {
      // Queue for when socket connects
      listenersRef.current.push({ event, handler })
    }
    // Return cleanup function
    return () => {
      socketRef.current?.off(event, handler)
      // Also remove from queue
      listenersRef.current = listenersRef.current.filter(
        l => !(l.event === event && l.handler === handler)
      )
    }
  }, [])

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler)
  }, [])

  return { connected, emit, on, off }
}
