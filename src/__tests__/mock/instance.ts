import { vi, type Mock } from 'vitest'
import type OBSInstance from '../../main.js'
import { type ModuleConfig, type ModuleSecrets, OBSMediaStatus, ObsAudioMonitorType } from '../../types.js'
import { validName } from '../../utils.js'
import { OBSState } from '../../state.js'
import { OBSApi } from '../../api.js'
import { makeMockSocket, type MockOBSWebSocket } from './socket.js'

/**
 * An `OBSInstance` stand-in for tests. It wires the real `OBSApi` and `OBSState` to a
 * {@link MockOBSWebSocket}, and replaces the Companion `InstanceBase` methods that actions,
 * feedbacks, the API layer and listeners call with vitest mocks so they can be asserted on.
 *
 * Because the real `OBSApi` and `OBSState` are used, tests exercise actual request building
 * and state mutation — only the network (socket) and the Companion runtime are faked.
 */
export type MockInstance = OBSInstance & {
	socket: MockOBSWebSocket
	setVariableValues: Mock
	setVariableDefinitions: Mock
	setActionDefinitions: Mock
	setFeedbackDefinitions: Mock
	setPresetDefinitions: Mock
	checkFeedbacks: Mock
	updateStatus: Mock
	recordAction: Mock
	updateActionsFeedbacksVariables: Mock
	sendToActionRecorder: Mock
	log: Mock
}

export function makeMockInstance(config?: Partial<ModuleConfig>, secrets?: Partial<ModuleSecrets>): MockInstance {
	const obsState = new OBSState()

	const self = {
		socket: makeMockSocket(),
		obsState,
		config: { host: '127.0.0.1', port: 4455, ...config },
		secrets: { ...secrets },
		isRecordingActions: false,
		get states() {
			return obsState.state
		},
		// InstanceBase methods exercised by the module under test
		setVariableValues: vi.fn(),
		setVariableDefinitions: vi.fn(),
		setActionDefinitions: vi.fn(),
		setFeedbackDefinitions: vi.fn(),
		setPresetDefinitions: vi.fn(),
		checkFeedbacks: vi.fn(),
		updateStatus: vi.fn(),
		recordAction: vi.fn(),
		updateActionsFeedbacksVariables: vi.fn(),
		sendToActionRecorder: vi.fn(),
		log: vi.fn(),
	} as unknown as MockInstance

	// OBSApi captures `self` in its constructor; safe to attach after the object exists.
	self.obs = new OBSApi(self)
	return self
}

/** Seed a scene into module state (mirrors what the SceneList builders populate). */
export function seedScene(self: MockInstance, sceneName: string, sceneUuid = sceneName): void {
	self.states.scenes.set(sceneUuid, {
		sceneName,
		sceneUuid,
		sceneIndex: self.states.scenes.size,
	})
}

/** Seed a source/input into module state (mirrors `OBSApi.addSource`). */
export function seedSource(self: MockInstance, sourceName: string, sourceUuid = sourceName, inputKind?: string): void {
	self.states.sources.set(sourceUuid, {
		sourceName,
		sourceUuid,
		validName: validName(sourceName),
		isGroup: false,
		inputKind,
	})
}

/**
 * Populate a representative slice of every state collection the choice lists, variables and
 * presets read from. Used by the contract/smoke tests so that every action, feedback and
 * preset has real options to iterate over and lookups resolve.
 */
export function seedFullState(self: MockInstance): void {
	const s = self.states

	seedScene(self, 'Scene A')
	seedScene(self, 'Scene B')
	s.programScene = 'Scene A'
	s.programSceneUuid = 'Scene A'
	s.previewScene = 'Scene B'
	s.previewSceneUuid = 'Scene B'
	s.studioMode = true

	// Audio input
	s.sources.set('Mic', {
		sourceName: 'Mic',
		sourceUuid: 'Mic',
		validName: 'Mic',
		isGroup: false,
		inputKind: 'wasapi_input_capture',
		inputMuted: false,
		inputVolume: 0,
		inputAudioBalance: 0.5,
		inputAudioSyncOffset: 0,
		monitorType: ObsAudioMonitorType.None,
		inputAudioTracks: { '1': true },
	})
	// Media input
	s.sources.set('Clip', {
		sourceName: 'Clip',
		sourceUuid: 'Clip',
		validName: 'Clip',
		isGroup: false,
		inputKind: 'ffmpeg_source',
		settings: { local_file: '/media/clip.mp4' },
		OBSMediaStatus: OBSMediaStatus.Playing,
		timeElapsed: '00:00:05',
		timeRemaining: '00:00:55',
	})
	// Text input
	s.sources.set('Title', {
		sourceName: 'Title',
		sourceUuid: 'Title',
		validName: 'Title',
		isGroup: false,
		inputKind: 'text_gdiplus_v2',
		settings: { text: 'Hello' },
	})
	// Image input
	s.sources.set('Logo', {
		sourceName: 'Logo',
		sourceUuid: 'Logo',
		validName: 'Logo',
		isGroup: false,
		inputKind: 'image_source',
		settings: { file: '/media/logo.png' },
	})

	s.transitions.set('Fade', {
		transitionName: 'Fade',
		transitionUuid: 'Fade',
		transitionType: 'fade_transition',
		transitionFixed: false,
		transitionConfigurable: true,
	})
	s.currentTransition = 'Fade'

	s.profiles.set('Profile 1', {})
	s.currentProfile = 'Profile 1'
	s.sceneCollections.set('Collection 1', {})
	s.currentSceneCollection = 'Collection 1'
	s.outputs.set('virtualcam_output', {})

	s.sourceFilters.set('Mic', [
		{ filterName: 'Gain', filterEnabled: true, filterIndex: 0, filterKind: 'gain_filter', filterSettings: {} },
	])

	s.sceneItems.set('Scene A', [
		{
			sceneItemId: 1,
			sourceName: 'Logo',
			sourceUuid: 'Logo',
			sceneItemIndex: 0,
			sceneItemLocked: false,
			sceneItemEnabled: true,
			isGroup: false,
			inputKind: 'image_source',
			sourceType: 'OBS_SOURCE_TYPE_INPUT',
		},
	])
}
