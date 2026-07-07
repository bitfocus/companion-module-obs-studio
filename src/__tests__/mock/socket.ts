import { EventEmitter } from 'node:events'
import { vi, type Mock } from 'vitest'
import type OBSWebSocket from 'obs-websocket-js'

/** Fake OBSWebSocket implementation for mocking requests and triggering events in tests. */
export type MockOBSWebSocket = OBSWebSocket & {
	call: Mock
	callBatch: Mock
	connect: Mock
	disconnect: Mock
	reidentify: Mock
	/** Emit an OBS event to listeners. */
	emit(event: string, ...args: unknown[]): boolean
}

export function makeMockSocket(): MockOBSWebSocket {
	const socket = new EventEmitter() as unknown as MockOBSWebSocket
	socket.call = vi.fn().mockResolvedValue({})
	socket.callBatch = vi.fn().mockResolvedValue([])
	socket.connect = vi.fn().mockResolvedValue({ obsWebSocketVersion: '5.0.0', rpcVersion: 1 })
	socket.disconnect = vi.fn().mockResolvedValue(undefined)
	socket.reidentify = vi.fn().mockResolvedValue(undefined)
	return socket
}
