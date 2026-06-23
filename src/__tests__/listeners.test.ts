import { beforeEach, describe, expect, test } from 'vitest'
import { initOBSListeners } from '../listeners.js'
import { OBSRecordingState } from '../types.js'
import { makeMockInstance, seedScene, seedSource, type MockInstance } from './mock/instance.js'

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
			'scene_active',
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
		expect(self.checkFeedbacks).toHaveBeenCalledWith('streaming', 'streamCongestion', 'streamReconnecting')
	})

	test('StreamStateChanged RECONNECTED clears reconnecting state', () => {
		self.states.streamReconnecting = true
		self.socket.emit('StreamStateChanged', { outputActive: true, outputState: 'OBS_WEBSOCKET_OUTPUT_RECONNECTED' })

		expect(self.states.streamReconnecting).toBe(false)
		expect(self.setVariableValues).toHaveBeenCalledWith({ streaming: 'Live' })
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

	test('InputAudioTracksChanged updates the cached audio tracks', () => {
		seedSource(self, 'Mic')

		self.socket.emit('InputAudioTracksChanged', {
			inputName: 'Mic',
			inputUuid: 'Mic',
			inputAudioTracks: { '1': false, '2': true },
		})

		expect(self.states.sources.get('Mic')?.inputAudioTracks).toEqual({ '1': false, '2': true })
	})

	test('ScreenshotSaved sets the screenshot path variable', () => {
		self.socket.emit('ScreenshotSaved', { savedScreenshotPath: '/tmp/shot.png' })

		expect(self.setVariableValues).toHaveBeenCalledWith({ screenshot_saved_path: '/tmp/shot.png' })
	})
})
