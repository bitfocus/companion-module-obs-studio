import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { initOBSListeners } from '../listeners.js'
import { OBSRecordingState } from '../types.js'
import {
	makeMockInstance,
	sceneItem,
	seedScene,
	seedSource,
	seedFullState,
	type MockInstance,
} from './mock/instance.js'

describe('scene change listeners', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		seedScene(self, 'Scene A')
		seedScene(self, 'Scene B')
		self.states.programScene = 'Scene A'
		self.states.programSceneUuid = 'Scene A'
		initOBSListeners(self)
	})

	test('CurrentProgramSceneChanged updates program/previous state and notifies', () => {
		self.socket.emit('CurrentProgramSceneChanged', { sceneName: 'Scene B', sceneUuid: 'Scene B' })

		expect(self.states.programScene).toBe('Scene B')
		expect(self.states.previousScene).toBe('Scene A')
		expect(self.setVariableValues).toHaveBeenCalledWith({ scene_active: 'Scene B', scene_previous: 'Scene A' })
		expect(self.checkFeedbacks).toHaveBeenCalledWith(
			'sceneProgram',
			'scenePrevious',
			'scene_item_active',
			'scene_item_active_in_scene',
		)
	})

	test('CurrentPreviewSceneChanged updates preview state', () => {
		self.socket.emit('CurrentPreviewSceneChanged', { sceneName: 'Scene B', sceneUuid: 'Scene B' })

		expect(self.states.previewScene).toBe('Scene B')
		expect(self.setVariableValues).toHaveBeenCalledWith({ scene_preview: 'Scene B' })
	})
})

describe('output state listeners', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		initOBSListeners(self)
	})

	test('RecordStateChanged normalizes RESUMED to an active recording', () => {
		self.socket.emit('RecordStateChanged', { outputActive: true, outputState: 'OBS_WEBSOCKET_OUTPUT_RESUMED' })

		expect(self.states.recording).toBe(OBSRecordingState.Recording)
		expect(self.setVariableValues).toHaveBeenCalledWith({ recording: 'Recording' })
	})

	test('StreamStateChanged RECONNECTING sets reconnecting state and label', () => {
		self.socket.emit('StreamStateChanged', { outputActive: true, outputState: 'OBS_WEBSOCKET_OUTPUT_RECONNECTING' })

		expect(self.states.streamReconnecting).toBe(true)
		expect(self.states.streaming).toBe(true)
		expect(self.setVariableValues).toHaveBeenCalledWith({ streaming: 'Reconnecting' })
		expect(self.checkFeedbacks).toHaveBeenCalledWith(
			'streaming',
			'streamCongestionAbove',
			'streamCongestionLevel',
			'streamReconnecting',
		)
	})

	test('StreamStateChanged RECONNECTED clears reconnecting state', () => {
		self.states.streamReconnecting = true
		self.socket.emit('StreamStateChanged', { outputActive: true, outputState: 'OBS_WEBSOCKET_OUTPUT_RECONNECTED' })

		expect(self.states.streamReconnecting).toBe(false)
		expect(self.setVariableValues).toHaveBeenCalledWith({ streaming: 'Live' })
	})

	test('ReplayBufferStateChanged updates state and the replay_buffer_active variable', () => {
		self.socket.emit('ReplayBufferStateChanged', { outputActive: true, outputState: 'OBS_WEBSOCKET_OUTPUT_STARTED' })

		expect(self.states.replayBuffer).toBe(true)
		expect(self.setVariableValues).toHaveBeenCalledWith({ replay_buffer_active: true })
		expect(self.checkFeedbacks).toHaveBeenCalledWith('replayBufferActive')
	})

	test('VirtualcamStateChanged updates the virtualcam_active variable', () => {
		self.states.outputs.set('virtualcam_output', { outputName: 'virtualcam_output', outputActive: false })

		self.socket.emit('VirtualcamStateChanged', { outputActive: true, outputState: 'OBS_WEBSOCKET_OUTPUT_STARTED' })

		expect(self.states.outputs.get('virtualcam_output')?.outputActive).toBe(true)
		expect(self.setVariableValues).toHaveBeenCalledWith({ virtualcam_active: true })
	})
})

describe('input / filter / ui listeners', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		initOBSListeners(self)
	})

	test('SourceFilterSettingsChanged updates the cached filter settings', () => {
		seedSource(self, 'Mic')
		self.states.sourceFilters.set('Mic', [
			{ filterName: 'Gain', filterEnabled: true, filterIndex: 0, filterKind: 'gain_filter', filterSettings: { db: 0 } },
		])

		self.socket.emit('SourceFilterSettingsChanged', {
			sourceName: 'Mic',
			filterName: 'Gain',
			filterSettings: { db: 10 },
		})

		expect(self.states.sourceFilters.get('Mic')?.[0].filterSettings).toEqual({ db: 10 })
	})

	test('InputAudioTracksChanged updates the cached audio tracks and the tracks_ variable', () => {
		seedSource(self, 'Mic')

		self.socket.emit('InputAudioTracksChanged', {
			inputName: 'Mic',
			inputUuid: 'Mic',
			inputAudioTracks: { '1': false, '2': true },
		})

		expect(self.states.sources.get('Mic')?.inputAudioTracks).toEqual({ '1': false, '2': true })
		expect(self.setVariableValues).toHaveBeenCalledWith({ tracks_Mic: [2] })
		expect(self.checkFeedbacks).toHaveBeenCalledWith('audio_track')
	})

	test('InputAudioTracksChanged records the changed tracks per direction', () => {
		seedSource(self, 'Mic')
		self.states.sources.get('Mic')!.inputAudioTracks = { '1': true, '2': false, '3': true }

		self.socket.emit('InputAudioTracksChanged', {
			inputName: 'Mic',
			inputUuid: 'Mic',
			inputAudioTracks: { '1': false, '2': true, '3': true },
		})

		expect(self.sendToActionRecorder).toHaveBeenCalledWith({
			actionId: 'set_audio_tracks',
			options: { source: 'Mic', tracks: ['2'], value: 'true' },
		})
		expect(self.sendToActionRecorder).toHaveBeenCalledWith({
			actionId: 'set_audio_tracks',
			options: { source: 'Mic', tracks: ['1'], value: 'false' },
		})
	})

	test('StudioModeStateChanged sets the studio_mode variable', async () => {
		self.socket.call.mockResolvedValue({ sceneName: 'Scene A', sceneUuid: 'scene-a' })

		self.socket.emit('StudioModeStateChanged', { studioModeEnabled: true })
		await new Promise((resolve) => setImmediate(resolve))

		expect(self.states.studioMode).toBe(true)
		expect(self.setVariableValues).toHaveBeenCalledWith({ studio_mode: true })
	})

	test('ScreenshotSaved sets the screenshot path variable', () => {
		self.socket.emit('ScreenshotSaved', { savedScreenshotPath: '/tmp/shot.png' })

		expect(self.setVariableValues).toHaveBeenCalledWith({ screenshot_saved_path: '/tmp/shot.png' })
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

describe('media poll lifetime', () => {
	let self: MockInstance

	beforeEach(() => {
		vi.useFakeTimers()
		self = makeMockInstance()
		seedFullState(self)
		initOBSListeners(self)
	})

	afterEach(() => {
		self.obs.stopMediaPoll()
		vi.useRealTimers()
	})

	test('removing the last media input stops the poll', () => {
		self.obs.reconcileMediaPoll()
		expect(self.mediaPoll).toBeDefined()

		self.socket.emit('InputRemoved', { inputName: 'Clip', inputUuid: 'Clip' })

		expect(self.mediaPoll).toBeUndefined()
	})

	test('removing a non-media input leaves the poll running', () => {
		self.obs.reconcileMediaPoll()
		expect(self.mediaPoll).toBeDefined()

		self.socket.emit('InputRemoved', { inputName: 'Mic', inputUuid: 'Mic' })

		expect(self.mediaPoll).toBeDefined()
	})

	test('a scene collection change stops the poll while state is inconsistent', () => {
		self.obs.reconcileMediaPoll()
		expect(self.mediaPoll).toBeDefined()

		self.socket.emit('CurrentSceneCollectionChanging', { sceneCollectionName: 'Other' })

		expect(self.mediaPoll).toBeUndefined()
	})
})
