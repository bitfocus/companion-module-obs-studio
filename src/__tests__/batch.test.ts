import { describe, expect, test } from 'vitest'
import { BatchBuilder, successfulEntry } from '../batch.js'
import type { OBSBatchResponse } from '../types.js'

type TestSpec = {
	mute: { meta: { uuid: string }; payload: { inputMuted: boolean } }
	volume: { meta: { uuid: string }; payload: { inputVolumeDb: number } }
}

/** Echoes the request IDs the builder generated, as OBS does. */
function respond(
	builder: BatchBuilder<TestSpec>,
	responseData: Record<string, unknown> | undefined,
): OBSBatchResponse[] {
	return builder.requests.map((request) => ({
		requestType: request.requestType,
		requestId: request.requestId!,
		requestStatus: responseData === undefined ? { result: false, code: 604 } : { result: true, code: 100 },
		responseData,
	}))
}

describe('BatchBuilder', () => {
	test('assigns a unique request ID even when the same target is added twice', () => {
		const builder = new BatchBuilder<TestSpec>()
		builder.add('mute', 'GetInputMute', { inputUuid: 'mic' }, { uuid: 'mic' }, false)
		builder.add('mute', 'GetInputMute', { inputUuid: 'mic' }, { uuid: 'mic' }, false)

		const ids = builder.requests.map((request) => request.requestId)
		expect(ids).toHaveLength(2)
		expect(new Set(ids).size).toBe(2)
	})

	test('resolves responses back to the metadata recorded for each request', () => {
		const builder = new BatchBuilder<TestSpec>()
		builder.add('mute', 'GetInputMute', { inputUuid: 'mic' }, { uuid: 'mic' }, false)
		builder.add('volume', 'GetInputVolume', { inputUuid: 'cam' }, { uuid: 'cam' }, false)

		const entries = builder.resolve([
			{
				requestType: 'GetInputVolume',
				requestId: builder.requests[1].requestId!,
				requestStatus: { result: true, code: 100 },
				responseData: { inputVolumeDb: -6 },
			},
			{
				requestType: 'GetInputMute',
				requestId: builder.requests[0].requestId!,
				requestStatus: { result: true, code: 100 },
				responseData: { inputMuted: true },
			},
		])

		// Correlation is by ID, so out-of-order responses still land on the right metadata.
		expect(entries.map((entry) => [entry.kind, entry.meta.uuid])).toEqual([
			['volume', 'cam'],
			['mute', 'mic'],
		])
	})

	test('drops responses carrying a request ID that was never sent', () => {
		const builder = new BatchBuilder<TestSpec>()
		builder.add('mute', 'GetInputMute', { inputUuid: 'mic' }, { uuid: 'mic' }, false)

		const entries = builder.resolve([
			{
				requestType: 'GetInputMute',
				requestId: 'not-a-request-we-sent',
				requestStatus: { result: true, code: 100 },
				responseData: { inputMuted: true },
			},
		])

		expect(entries).toEqual([])
	})

	test('tracks which requests were marked optional', () => {
		const builder = new BatchBuilder<TestSpec>()
		builder.add('mute', 'GetInputMute', { inputUuid: 'mic' }, { uuid: 'mic' }, false)
		builder.add('volume', 'GetInputVolume', { inputUuid: 'mic' }, { uuid: 'mic' }, true)

		expect(builder.isOptional(builder.requests[0].requestId!)).toBe(false)
		expect(builder.isOptional(builder.requests[1].requestId!)).toBe(true)
		expect(builder.isOptional('unknown')).toBe(false)
	})
})

describe('successfulEntry', () => {
	test('rejects a failed request and one that returned no payload', () => {
		const builder = new BatchBuilder<TestSpec>()
		builder.add('mute', 'GetInputMute', { inputUuid: 'mic' }, { uuid: 'mic' }, false)

		expect(successfulEntry(builder.resolve(respond(builder, undefined))[0])).toBeUndefined()
		expect(successfulEntry(builder.resolve(respond(builder, { inputMuted: true }))[0])).toBeDefined()

		const noPayload = builder.resolve([
			{
				requestType: 'GetInputMute',
				requestId: builder.requests[0].requestId!,
				requestStatus: { result: true, code: 100 },
			},
		])
		expect(successfulEntry(noPayload[0])).toBeUndefined()
	})
})
