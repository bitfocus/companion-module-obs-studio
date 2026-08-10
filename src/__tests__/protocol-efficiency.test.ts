import { beforeEach, describe, expect, test } from 'vitest'
import type { CompanionFeedbackBooleanEvent } from '@companion-module/base'
import { initOBSListeners } from '../listeners.js'
import { getOutputFeedbacks } from '../feedbacks/outputs.js'
import { makeMockInstance, seedScene, seedSource, type MockInstance } from './mock/instance.js'
import type { OBSBatchRequest, OBSSceneItem } from '../types.js'
import { RequestBatchExecutionType } from 'obs-websocket-js'
import { looseFeedbacks } from './loose-definitions.js'
import { MockContext } from './mock-context.js'

function sceneItem(partial: Partial<OBSSceneItem> & { sceneItemId: number; sourceUuid: string }): OBSSceneItem {
	return {
		sourceName: partial.sourceUuid,
		sceneItemIndex: 0,
		sceneItemLocked: false,
		sceneItemEnabled: true,
		isGroup: false,
		inputKind: null,
		sourceType: 'OBS_SOURCE_TYPE_INPUT',
		...partial,
	}
}

function feedbackEvent(feedbackId: string, options: Record<string, unknown>): CompanionFeedbackBooleanEvent {
	return { id: 'fb', feedbackId, controlId: 'c', options } as unknown as CompanionFeedbackBooleanEvent
}

describe('getInputKindList', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
	})

	test('fetches all kind defaults in a single parallel batch instead of one request per kind', async () => {
		self.socket.call.mockResolvedValue({ inputKinds: ['text_gdiplus_v2', 'ffmpeg_source'] })
		self.socket.callBatch.mockResolvedValue([
			{
				requestType: 'GetInputDefaultSettings',
				requestId: 'text_gdiplus_v2',
				requestStatus: { result: true, code: 100 },
				responseData: { defaultInputSettings: { text: '' } },
			},
			{
				requestType: 'GetInputDefaultSettings',
				requestId: 'ffmpeg_source',
				requestStatus: { result: true, code: 100 },
				responseData: { defaultInputSettings: { local_file: '' } },
			},
		])

		await self.obs.getInputKindList()

		expect(self.socket.callBatch).toHaveBeenCalledTimes(1)
		expect(self.socket.callBatch).toHaveBeenCalledWith(
			[
				{
					requestType: 'GetInputDefaultSettings',
					requestData: { inputKind: 'text_gdiplus_v2' },
					requestId: 'text_gdiplus_v2',
				},
				{
					requestType: 'GetInputDefaultSettings',
					requestData: { inputKind: 'ffmpeg_source' },
					requestId: 'ffmpeg_source',
				},
			],
			{ executionType: RequestBatchExecutionType.Parallel },
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

	test('getStreamStatus no longer batches GetStreamServiceSettings', async () => {
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
		expect(self.setVariableValues).toHaveBeenCalledWith(
			expect.not.objectContaining({ stream_service: expect.anything() }),
		)
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

	test('getRecordStatus no longer batches GetRecordDirectory', async () => {
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
		expect(batch.map((r) => r.requestId)).toEqual(['adv_stream'])
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

		self.socket.callBatch.mockResolvedValue([
			{
				requestType: 'GetMediaInputStatus',
				requestId: 'clip-uuid',
				requestStatus: { result: true, code: 100 },
				responseData: { mediaState: 'OBS_MEDIA_STATE_PLAYING', mediaCursor: 1000, mediaDuration: 5000 },
			},
		])

		await self.obs.getOBSMediaStatus()

		const batch = self.socket.callBatch.mock.calls[0][0] as OBSBatchRequest[]
		expect(batch).toEqual([
			{ requestId: 'clip-uuid', requestType: 'GetMediaInputStatus', requestData: { inputUuid: 'clip-uuid' } },
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

describe('SceneItemListReindexed', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		initOBSListeners(self)
	})

	test('updates ordering on cached items without dropping other fields', () => {
		self.states.sceneItems.set('scene-a', [
			sceneItem({ sceneItemId: 1, sourceUuid: 'a', sceneItemIndex: 0, sceneItemEnabled: false }),
			sceneItem({ sceneItemId: 2, sourceUuid: 'b', sceneItemIndex: 1, sceneItemEnabled: true }),
		])

		self.socket.emit('SceneItemListReindexed', {
			sceneUuid: 'scene-a',
			sceneName: 'Scene A',
			sceneItems: [
				{ sceneItemId: 1, sceneItemIndex: 1 },
				{ sceneItemId: 2, sceneItemIndex: 0 },
			],
		})

		const items = self.states.sceneItems.get('scene-a')!
		expect(items.find((i) => i.sceneItemId === 1)).toMatchObject({ sceneItemIndex: 1, sceneItemEnabled: false })
		expect(items.find((i) => i.sceneItemId === 2)).toMatchObject({ sceneItemIndex: 0, sceneItemEnabled: true })
	})
})

describe('removeScene group cleanup', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
	})

	test('removes the group container and its source entry along with the scene', async () => {
		seedScene(self, 'Scene A', 'scene-a')
		self.states.sources.set('group-1', {
			sourceName: 'Group 1',
			sourceUuid: 'group-1',
			validName: 'Group_1',
			isGroup: true,
		})
		self.states.sceneItems.set('scene-a', [sceneItem({ sceneItemId: 1, sourceUuid: 'group-1', isGroup: true })])
		self.states.sceneItems.set('group-1', [sceneItem({ sceneItemId: 10, sourceUuid: 'member-1' })])

		await self.obs.removeScene('scene-a')

		expect(self.states.scenes.has('scene-a')).toBe(false)
		expect(self.states.sceneItems.has('scene-a')).toBe(false)
		expect(self.states.sceneItems.has('group-1')).toBe(false)
		expect(self.states.sources.has('group-1')).toBe(false)
	})
})
