import { EventEmitter } from 'node:events'
import { vi, type Mock } from 'vitest'
import type OBSWebSocket from 'obs-websocket-js'
import type { OBSBatchRequest } from '../../types.js'

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

/**
 * Answers `callBatch` by echoing back the request IDs the module generated, so tests describe
 * responses in terms of the request that produced them rather than depending on how IDs are formed.
 * A responder returning `undefined` produces a failed entry, as OBS does for unsupported requests.
 */
/** The batch entries passed to the most recent `callBatch` call. */
export function lastBatch(socket: MockOBSWebSocket): OBSBatchRequest[] {
	const calls = socket.callBatch.mock.calls
	return calls[calls.length - 1][0] as OBSBatchRequest[]
}

export function mockBatchResponses(
	socket: MockOBSWebSocket,
	respond: (request: OBSBatchRequest) => Record<string, unknown> | undefined,
): void {
	socket.callBatch.mockImplementation(async (batch: OBSBatchRequest[]) =>
		batch.map((request) => {
			const responseData = respond(request)
			return {
				requestType: request.requestType,
				requestId: request.requestId ?? '',
				requestStatus: responseData === undefined ? { result: false, code: 604 } : { result: true, code: 100 },
				responseData,
			}
		}),
	)
}
