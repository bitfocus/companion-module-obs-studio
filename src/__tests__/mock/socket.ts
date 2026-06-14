import { EventEmitter } from 'node:events'
import { vi, type Mock } from 'vitest'
import type OBSWebSocket from 'obs-websocket-js'

/**
 * A fake `OBSWebSocket` for tests. The request surface (`call` / `callBatch`) is replaced
 * with vitest mocks so tests can stub responses and assert on outgoing requests, while the
 * event surface (`on` / `once` / `emit` / `removeAllListeners`) is backed by a real
 * EventEmitter so listener registration in `initOBSListeners` can be exercised by emitting
 * events directly.
 */
export type MockOBSWebSocket = OBSWebSocket & {
	call: Mock
	callBatch: Mock
	connect: Mock
	disconnect: Mock
	/** Emit an OBS event to any listeners registered via `socket.on(...)`. */
	emit(event: string, ...args: unknown[]): boolean
}

export function makeMockSocket(): MockOBSWebSocket {
	const socket = new EventEmitter() as unknown as MockOBSWebSocket
	socket.call = vi.fn().mockResolvedValue({})
	socket.callBatch = vi.fn().mockResolvedValue([])
	socket.connect = vi.fn().mockResolvedValue({ obsWebSocketVersion: '5.0.0', rpcVersion: 1 })
	socket.disconnect = vi.fn().mockResolvedValue(undefined)
	return socket
}
