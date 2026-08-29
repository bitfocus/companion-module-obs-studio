import { beforeEach, describe, expect, test } from 'vitest'
import { getOutputFeedbacks } from '../feedbacks/outputs.js'
import { makeMockInstance, seedSource, type MockInstance } from './mock/instance.js'
import { mockBatchResponses } from './mock/socket.js'
import { feedbackEvent } from './mock/events.js'
import type { OBSBatchRequest } from '../types.js'
import { RequestBatchExecutionType } from 'obs-websocket-js'
import { looseFeedbacks } from './loose-definitions.js'
import { MockContext } from './mock-context.js'

describe('getInputKindList', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
	})

	test('fetches every kind default in one batch', async () => {
		self.socket.call.mockResolvedValue({ inputKinds: ['text_gdiplus_v2', 'ffmpeg_source'] })
		mockBatchResponses(self.socket, (request) =>
			request.requestData?.inputKind === 'text_gdiplus_v2'
				? { defaultInputSettings: { text: '' } }
				: { defaultInputSettings: { local_file: '' } },
		)

		await self.obs.getInputKindList()

		expect(self.socket.callBatch).toHaveBeenCalledTimes(1)
		expect(self.socket.callBatch).toHaveBeenCalledWith(
			[
				{
					requestType: 'GetInputDefaultSettings',
					requestData: { inputKind: 'text_gdiplus_v2' },
					requestId: expect.any(String),
				},
				{
					requestType: 'GetInputDefaultSettings',
					requestData: { inputKind: 'ffmpeg_source' },
					requestId: expect.any(String),
				},
			],
			// Never Parallel: OBS pairs parallel results with the wrong request.
			{ executionType: RequestBatchExecutionType.SerialRealtime },
		)
		expect(self.states.inputKindList.get('text_gdiplus_v2')).toEqual({ text: '' })
		expect(self.states.inputKindList.get('ffmpeg_source')).toEqual({ local_file: '' })
	})
})

describe('getStreamStatus / getRecordStatus', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
	})

	test('issues GetStreamStatus on its own and leaves stream_service alone', async () => {
		self.socket.call.mockResolvedValue({
			outputActive: true,
			outputTimecode: '00:01:00.000',
			outputCongestion: 0,
			outputBytes: 1000,
			outputSkippedFrames: 0,
			outputTotalFrames: 100,
		})

		await self.obs.getStreamStatus()

		expect(self.socket.call).toHaveBeenCalledWith('GetStreamStatus', undefined)
		expect(self.socket.callBatch).not.toHaveBeenCalled()
		// Asserted against every call, and only after confirming there was one:
		// `toHaveBeenCalledWith(not.objectContaining(...))` passes as soon as any single call omits the
		// key, and an empty call list would make the check vacuous.
		expect(self.setVariableValues.mock.calls.length).toBeGreaterThan(0)
		for (const [values] of self.setVariableValues.mock.calls) {
			expect(values).not.toHaveProperty('stream_service')
		}
	})

	test('getStreamServiceSettings sets stream_service independently', async () => {
		self.socket.call.mockResolvedValue({
			streamServiceType: 'rtmp_common',
			streamServiceSettings: { service: 'Twitch' },
		})

		await self.obs.getStreamServiceSettings()

		expect(self.socket.call).toHaveBeenCalledWith('GetStreamServiceSettings', undefined)
		expect(self.setVariableValues).toHaveBeenCalledWith({ stream_service: 'Twitch' })
	})

	test('issues GetRecordStatus on its own', async () => {
		self.socket.call.mockResolvedValue({ outputActive: false, outputPaused: false, outputTimecode: '00:00:00.000' })

		await self.obs.getRecordStatus()

		expect(self.socket.call).toHaveBeenCalledWith('GetRecordStatus', undefined)
		expect(self.socket.callBatch).not.toHaveBeenCalled()
	})
})

describe('profileInfo', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
	})

	test('refreshes profile-scoped data including record directory and stream service', async () => {
		self.socket.call.mockResolvedValue({})

		await self.obs.profileInfo()

		const requestTypes = self.socket.call.mock.calls.map((call: unknown[]) => call[0])
		expect(requestTypes).toEqual(
			expect.arrayContaining([
				'GetHotkeyList',
				'GetOutputList',
				'GetVideoSettings',
				'GetReplayBufferStatus',
				'GetRecordDirectory',
				'GetStreamServiceSettings',
			]),
		)
	})
})

describe('output status polling', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		self.states.outputs.set('adv_stream', { outputActive: false, outputName: 'adv_stream' })
		self.states.outputs.set('virtualcam_output', { outputActive: false, outputName: 'virtualcam_output' })
	})

	test('does not poll until an output_active feedback subscribes', async () => {
		await self.obs.getAllOutputStatuses()
		expect(self.socket.callBatch).not.toHaveBeenCalled()

		const feedbacks = looseFeedbacks(getOutputFeedbacks(self))
		await feedbacks['output_active'].callback(feedbackEvent('output_active', { output: 'adv_stream' }), {} as any)

		self.socket.callBatch.mockResolvedValue([])
		await self.obs.getAllOutputStatuses()
		expect(self.socket.callBatch).toHaveBeenCalledTimes(1)
	})

	test('excludes outputs with a dedicated state-changed event from the poll', async () => {
		const feedbacks = looseFeedbacks(getOutputFeedbacks(self))
		await feedbacks['output_active'].callback(feedbackEvent('output_active', { output: 'adv_stream' }), {} as any)

		self.socket.callBatch.mockResolvedValue([])
		await self.obs.getAllOutputStatuses()

		const batch = self.socket.callBatch.mock.calls[0][0] as OBSBatchRequest[]
		expect(batch.map((r) => r.requestData)).toEqual([{ outputName: 'adv_stream' }])
	})

	test('stops polling once the last output_active feedback unsubscribes', async () => {
		const feedbacks = looseFeedbacks(getOutputFeedbacks(self))
		await feedbacks['output_active'].callback(feedbackEvent('output_active', { output: 'adv_stream' }), {} as any)
		await feedbacks['output_active'].unsubscribe!(
			feedbackEvent('output_active', { output: 'adv_stream' }),
			new MockContext('feedback'),
		)

		await self.obs.getAllOutputStatuses()
		expect(self.socket.callBatch).not.toHaveBeenCalled()
	})
})

describe('media status polling', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
	})

	test('polls by inputUuid and caches kind membership across calls', async () => {
		seedSource(self, 'Clip', 'clip-uuid', 'ffmpeg_source')
		seedSource(self, 'Mic', 'mic-uuid', 'wasapi_input_capture')

		const first = self.obsState.mediaSourceUuids
		const second = self.obsState.mediaSourceUuids
		expect(first).toBe(second) // Same array instance: cached, not recomputed.
		expect(first).toEqual(['clip-uuid'])

		mockBatchResponses(self.socket, () => ({
			mediaState: 'OBS_MEDIA_STATE_PLAYING',
			mediaCursor: 1000,
			mediaDuration: 5000,
		}))

		await self.obs.getOBSMediaStatus()

		const batch = self.socket.callBatch.mock.calls[0][0] as OBSBatchRequest[]
		expect(batch).toEqual([
			{ requestId: expect.any(String), requestType: 'GetMediaInputStatus', requestData: { inputUuid: 'clip-uuid' } },
		])
		expect(self.setVariableValues).toHaveBeenCalledWith(expect.objectContaining({ media_status_Clip: 'Playing' }))
	})

	test('invalidates the cache when a new media source is added', () => {
		seedSource(self, 'Clip', 'clip-uuid', 'ffmpeg_source')
		expect(self.obsState.mediaSourceUuids).toEqual(['clip-uuid'])

		self.obs.addSource('clip2-uuid', 'Clip 2', 'vlc_source')
		expect(self.obsState.mediaSourceUuids).toEqual(['clip-uuid', 'clip2-uuid'])
	})
})

describe('poll feedback gating', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
	})

	function statsResponse(availableDiskSpace: number) {
		return {
			activeFps: 30,
			renderTotalFrames: 100,
			renderSkippedFrames: 0,
			outputTotalFrames: 100,
			outputSkippedFrames: 0,
			averageFrameRenderTime: 1,
			cpuUsage: 1,
			memoryUsage: 1,
			availableDiskSpace,
		}
	}

	test('getStats only re-checks the disk threshold when free space moves', async () => {
		self.socket.call.mockResolvedValue(statsResponse(50000))
		await self.obs.getStats()
		expect(self.checkFeedbacks).toHaveBeenCalledWith('freeDiskSpaceRemaining')

		self.checkFeedbacks.mockClear()
		await self.obs.getStats()
		expect(self.checkFeedbacks).not.toHaveBeenCalled()

		self.socket.call.mockResolvedValue(statsResponse(49000))
		await self.obs.getStats()
		expect(self.checkFeedbacks).toHaveBeenCalledWith('freeDiskSpaceRemaining')
	})

	test('getStreamStatus only re-checks streaming and congestion when they change', async () => {
		const streamResponse = (outputActive: boolean, outputCongestion: number) => ({
			outputActive,
			outputCongestion,
			outputTimecode: '00:01:00.000',
			outputBytes: 1000,
			outputSkippedFrames: 0,
			outputTotalFrames: 100,
		})

		self.socket.call.mockResolvedValue(streamResponse(true, 0.1))
		await self.obs.getStreamStatus()

		// A tick with nothing moving must not re-evaluate either feedback.
		self.checkFeedbacks.mockClear()
		await self.obs.getStreamStatus()
		expect(self.checkFeedbacks).not.toHaveBeenCalled()

		self.socket.call.mockResolvedValue(streamResponse(true, 0.9))
		await self.obs.getStreamStatus()
		expect(self.checkFeedbacks).toHaveBeenCalledWith('streamCongestion', 'streamCongestionLevel')
		expect(self.checkFeedbacks).not.toHaveBeenCalledWith('streaming')

		self.checkFeedbacks.mockClear()
		self.socket.call.mockResolvedValue(streamResponse(false, 0.9))
		await self.obs.getStreamStatus()
		expect(self.checkFeedbacks).toHaveBeenCalledWith('streaming')
	})

	test('getRecordStatus only re-checks recording feedbacks on a state change', async () => {
		self.socket.call.mockResolvedValue({ outputActive: true, outputPaused: false, outputTimecode: '00:00:10.000' })
		await self.obs.getRecordStatus()
		expect(self.checkFeedbacks).toHaveBeenCalledWith('recording', 'recordingPaused')

		// Same state, later timecode: the timecode variables still update, the feedbacks do not re-run.
		self.checkFeedbacks.mockClear()
		self.socket.call.mockResolvedValue({ outputActive: true, outputPaused: false, outputTimecode: '00:00:11.000' })
		await self.obs.getRecordStatus()
		expect(self.checkFeedbacks).not.toHaveBeenCalled()

		self.socket.call.mockResolvedValue({ outputActive: true, outputPaused: true, outputTimecode: '00:00:12.000' })
		await self.obs.getRecordStatus()
		expect(self.checkFeedbacks).toHaveBeenCalledWith('recording', 'recordingPaused')
	})

	test('stream frame counters do not overwrite the global encoder counters', async () => {
		const written: Record<string, unknown> = {}
		self.setVariableValues.mockImplementation((values: Record<string, unknown>) => Object.assign(written, values))

		self.socket.call.mockResolvedValue({ ...statsResponse(1), outputTotalFrames: 1111, outputSkippedFrames: 22 })
		await self.obs.getStats()

		self.socket.call.mockResolvedValue({
			outputActive: true,
			outputCongestion: 0,
			outputTimecode: '00:01:00.000',
			outputBytes: 1000,
			outputTotalFrames: 8888,
			outputSkippedFrames: 77,
		})
		await self.obs.getStreamStatus()

		// GetStats owns the global counters; the stream's own counters get their own names.
		expect(written.output_total_frames).toBe(1111)
		expect(written.output_skipped_frames).toBe(22)
		expect(written.stream_output_total_frames).toBe(8888)
		expect(written.stream_output_skipped_frames).toBe(77)
	})
})
