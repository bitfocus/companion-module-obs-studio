import { beforeEach, describe, expect, test } from 'vitest'
import { initOBSListeners } from '../../listeners.js'
import { ObsAudioMonitorType } from '../../types.js'
import { makeMockInstance, seedScene, seedSource, type MockInstance } from '../mock/instance.js'

describe('rename listeners', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		initOBSListeners(self)
	})

	test('InputNameChanged refreshes the name, the valid name and the name index', () => {
		seedSource(self, 'Cam', 'cam-uuid')

		self.socket.emit('InputNameChanged', { inputUuid: 'cam-uuid', oldInputName: 'Cam', inputName: 'Camera One' })

		const source = self.states.sources.get('cam-uuid')!
		expect(source.sourceName).toBe('Camera One')
		expect(source.validName).toBe('Camera_One')
		// The index is what every action's source dropdown resolves through.
		expect(self.obsState.findSourceByName('Camera One')).toBe(source)
		expect(self.obsState.findSourceByName('Cam')).toBeUndefined()
		expect(self.updateActionsFeedbacksVariables).toHaveBeenCalled()
	})

	test('InputNameChanged for an input the module never saw is ignored', () => {
		self.socket.emit('InputNameChanged', { inputUuid: 'ghost', oldInputName: 'A', inputName: 'B' })

		expect(self.states.sources.size).toBe(0)
	})

	test('SceneNameChanged refreshes the name and the scene name index', () => {
		seedScene(self, 'Scene A', 'scene-a')

		self.socket.emit('SceneNameChanged', { sceneUuid: 'scene-a', oldSceneName: 'Scene A', sceneName: 'Intro' })

		const scene = self.states.scenes.get('scene-a')!
		expect(scene.sceneName).toBe('Intro')
		expect(self.obsState.findSceneByName('Intro')).toBe(scene)
		expect(self.obsState.findSceneByName('Scene A')).toBeUndefined()
	})
})

describe('scene collection change suppression', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		initOBSListeners(self)
		// What CurrentSceneCollectionChanging sets: a bulk reload is in progress.
		self.states.sceneCollectionChanging = true
	})

	test('SceneCreated during a bulk reload does not register the scene', () => {
		self.socket.emit('SceneCreated', { sceneName: 'New Scene', sceneUuid: 'new-scene', isGroup: false })

		expect(self.states.scenes.size).toBe(0)
	})

	test('InputCreated during a bulk reload does not register the input', () => {
		self.socket.emit('InputCreated', { inputName: 'Mic', inputUuid: 'mic', inputKind: 'wasapi_input_capture' })

		expect(self.states.sources.size).toBe(0)
		expect(self.socket.callBatch).not.toHaveBeenCalled()
	})

	test('SceneRemoved during a bulk reload leaves the scene alone', () => {
		self.states.sceneCollectionChanging = false
		seedScene(self, 'Scene A', 'scene-a')
		self.states.sceneCollectionChanging = true

		self.socket.emit('SceneRemoved', { sceneName: 'Scene A', sceneUuid: 'scene-a', isGroup: false })

		expect(self.states.scenes.has('scene-a')).toBe(true)
	})

	test('a group masquerading as a scene is never registered', () => {
		self.states.sceneCollectionChanging = false

		self.socket.emit('SceneCreated', { sceneName: 'My Group', sceneUuid: 'group-1', isGroup: true })

		// Groups live in the source map, not the scene map.
		expect(self.states.scenes.size).toBe(0)
	})

	test('InputCreated outside a bulk reload registers the input and fetches its data', () => {
		self.states.sceneCollectionChanging = false

		self.socket.emit('InputCreated', { inputName: 'Mic', inputUuid: 'mic', inputKind: 'wasapi_input_capture' })

		expect(self.states.sources.get('mic')?.inputKind).toBe('wasapi_input_capture')
		expect(self.socket.callBatch).toHaveBeenCalled()
	})
})

describe('audio property listeners', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		self.isRecordingActions = true
		seedSource(self, 'My Mic', 'mic-uuid')
		initOBSListeners(self)
	})

	test('InputMuteStateChanged updates state, the variable and the recorder', () => {
		self.socket.emit('InputMuteStateChanged', { inputName: 'My Mic', inputUuid: 'mic-uuid', inputMuted: true })

		expect(self.states.sources.get('mic-uuid')!.inputMuted).toBe(true)
		expect(self.setVariableValues).toHaveBeenCalledWith({ mute_My_Mic: 'Muted' })
		expect(self.checkFeedbacks).toHaveBeenCalledWith('audio_muted')
		expect(self.sendToActionRecorder).toHaveBeenCalledWith({
			actionId: 'mute',
			// Recorded options carry the OBS name, not the variable-safe one.
			options: { source: 'My Mic', mute: 'true' },
		})
	})

	test('InputVolumeChanged rounds to one decimal and records an instant set', () => {
		self.socket.emit('InputVolumeChanged', {
			inputName: 'My Mic',
			inputUuid: 'mic-uuid',
			inputVolumeMul: 0.5,
			inputVolumeDb: -6.0231,
		})

		expect(self.states.sources.get('mic-uuid')!.inputVolume).toBe(-6)
		expect(self.setVariableValues).toHaveBeenCalledWith({ volume_My_Mic: -6 })
		expect(self.sendToActionRecorder).toHaveBeenCalledWith({
			actionId: 'volume',
			options: { source: 'My Mic', mode: 'set', unit: 'db', value: -6, duration: 0 },
		})
	})

	test('InputAudioBalanceChanged updates the balance variable and records it', () => {
		self.socket.emit('InputAudioBalanceChanged', {
			inputName: 'My Mic',
			inputUuid: 'mic-uuid',
			inputAudioBalance: 0.7512,
		})

		expect(self.states.sources.get('mic-uuid')!.inputAudioBalance).toBe(0.8)
		expect(self.setVariableValues).toHaveBeenCalledWith({ balance_My_Mic: 0.8 })
		expect(self.sendToActionRecorder).toHaveBeenCalledWith({
			actionId: 'audio_balance',
			options: { source: 'My Mic', mode: 'set', value: 0.8 },
		})
	})

	test('InputAudioSyncOffsetChanged keeps the offset as a plain number', () => {
		self.socket.emit('InputAudioSyncOffsetChanged', {
			inputName: 'My Mic',
			inputUuid: 'mic-uuid',
			inputAudioSyncOffset: 250,
		})

		expect(self.states.sources.get('mic-uuid')!.inputAudioSyncOffset).toBe(250)
		// updateVariableValues writes this one too; a unit suffix here would make the type depend on
		// which writer ran last.
		expect(self.setVariableValues).toHaveBeenCalledWith({ sync_offset_My_Mic: 250 })
		expect(self.sendToActionRecorder).toHaveBeenCalledWith({
			actionId: 'audio_offset',
			options: { source: 'My Mic', mode: 'set', value: 250 },
		})
	})

	test.each([
		[ObsAudioMonitorType.MonitorAndOutput, 'Monitor / Output', true, 'true'],
		[ObsAudioMonitorType.MonitorOnly, 'Monitor Only', true, 'true'],
		[ObsAudioMonitorType.None, 'Off', false, 'false'],
	])('InputAudioMonitorTypeChanged %s', (monitorType, label, active, recorded) => {
		self.socket.emit('InputAudioMonitorTypeChanged', {
			inputName: 'My Mic',
			inputUuid: 'mic-uuid',
			monitorType,
		})

		expect(self.states.sources.get('mic-uuid')!.monitorType).toBe(monitorType)
		expect(self.setVariableValues).toHaveBeenCalledWith({
			monitor_My_Mic: label,
			monitor_active_My_Mic: active,
		})
		expect(self.checkFeedbacks).toHaveBeenCalledWith('audio_monitor_type')
		// The action only has on/off, so the legacy monitor-only type records as on.
		expect(self.sendToActionRecorder).toHaveBeenCalledWith({
			actionId: 'set_audio_monitor',
			options: { source: 'My Mic', monitor: recorded },
		})
	})

	test('an audio event for an unknown input touches nothing', () => {
		self.socket.emit('InputMuteStateChanged', { inputName: 'Ghost', inputUuid: 'ghost', inputMuted: true })

		expect(self.setVariableValues).not.toHaveBeenCalled()
		expect(self.sendToActionRecorder).not.toHaveBeenCalled()
	})
})

describe('input active/show listeners', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		seedSource(self, 'My Mic', 'mic-uuid')
		initOBSListeners(self)
	})

	test('InputActiveStateChanged updates state and the source_active variable', () => {
		self.socket.emit('InputActiveStateChanged', { inputName: 'My Mic', inputUuid: 'mic-uuid', videoActive: true })

		expect(self.states.sources.get('mic-uuid')!.active).toBe(true)
		expect(self.setVariableValues).toHaveBeenCalledWith({ source_active_My_Mic: true })
		expect(self.checkFeedbacks).toHaveBeenCalledWith('scene_item_active')
	})

	test('InputShowStateChanged updates the preview-showing state', () => {
		self.socket.emit('InputShowStateChanged', { inputName: 'My Mic', inputUuid: 'mic-uuid', videoShowing: true })

		expect(self.states.sources.get('mic-uuid')!.videoShowing).toBe(true)
		expect(self.checkFeedbacks).toHaveBeenCalledWith('scene_item_previewed')
	})
})

describe('InputSettingsChanged', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		initOBSListeners(self)
	})

	test('merges the reported settings over the cached ones', () => {
		seedSource(self, 'Title', 'title-uuid', 'text_gdiplus_v2')
		self.states.sources.get('title-uuid')!.settings = { text: 'Hello', color: 0xffffff }

		self.socket.emit('InputSettingsChanged', {
			inputName: 'Title',
			inputUuid: 'title-uuid',
			inputSettings: { text: 'Goodbye' },
		})

		// A partial settings event must not blank the keys it did not mention.
		expect(self.states.sources.get('title-uuid')!.settings).toEqual({ text: 'Goodbye', color: 0xffffff })
	})
})

describe('SceneItemRemoved', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		initOBSListeners(self)
	})

	test('drops only the removed item from its container', () => {
		self.states.sceneItems.set('scene-a', [
			{
				sceneItemId: 1,
				sourceName: 'A',
				sourceUuid: 'a',
				sceneItemIndex: 0,
				sceneItemLocked: false,
				sceneItemEnabled: true,
				isGroup: false,
				inputKind: null,
				sourceType: 'OBS_SOURCE_TYPE_INPUT',
			},
			{
				sceneItemId: 2,
				sourceName: 'B',
				sourceUuid: 'b',
				sceneItemIndex: 1,
				sceneItemLocked: false,
				sceneItemEnabled: true,
				isGroup: false,
				inputKind: null,
				sourceType: 'OBS_SOURCE_TYPE_INPUT',
			},
		])

		self.socket.emit('SceneItemRemoved', {
			sceneUuid: 'scene-a',
			sceneName: 'Scene A',
			sceneItemId: 1,
			sourceName: 'A',
			sourceUuid: 'a',
		})

		expect(self.states.sceneItems.get('scene-a')!.map((item) => item.sceneItemId)).toEqual([2])
	})

	test('an unknown container or item is a no-op', () => {
		expect(() =>
			self.socket.emit('SceneItemRemoved', {
				sceneUuid: 'nope',
				sceneName: 'Nope',
				sceneItemId: 1,
				sourceName: 'A',
				sourceUuid: 'a',
			}),
		).not.toThrow()
	})
})
