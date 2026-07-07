import { beforeEach, describe, expect, test } from 'vitest'
import { initOBSListeners } from '../listeners.js'
import { makeMockInstance, seedScene, seedSource, type MockInstance } from './mock/instance.js'

describe('addSource upsert', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
	})

	test('backfills inputKind on an existing source without downgrading it', () => {
		self.obs.addSource('uuid1', 'Cam')
		expect(self.states.sources.get('uuid1')!.inputKind).toBeUndefined()

		self.obs.addSource('uuid1', 'Cam', 'dshow_input')
		expect(self.states.sources.get('uuid1')!.inputKind).toBe('dshow_input')

		// A later call without a kind must not erase the known kind
		self.obs.addSource('uuid1', 'Cam', null)
		expect(self.states.sources.get('uuid1')!.inputKind).toBe('dshow_input')
	})

	test('refreshes name and validName and keeps the name index consistent', () => {
		self.obs.addSource('uuid1', 'Cam')
		expect(self.obsState.findSourceByName('Cam')).toBeDefined()

		self.obs.addSource('uuid1', 'Camera One')
		const source = self.states.sources.get('uuid1')!
		expect(source.sourceName).toBe('Camera One')
		expect(source.validName).toBe('Camera_One')
		expect(self.obsState.findSourceByName('Camera One')).toBe(source)
		expect(self.obsState.findSourceByName('Cam')).toBeUndefined()
	})

	test('upgrades to a group but never back', () => {
		self.obs.addSource('uuid1', 'My Group')
		self.obs.addSource('uuid1', 'My Group', null, true)
		expect(self.states.sources.get('uuid1')!.isGroup).toBe(true)

		self.obs.addSource('uuid1', 'My Group', null, false)
		expect(self.states.sources.get('uuid1')!.isGroup).toBe(true)
	})
})

describe('state epoch guard', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
	})

	test('buildSceneList discards the scene list if state is reset mid-flight', async () => {
		self.socket.call.mockImplementation(async (type: string) => {
			if (type === 'GetSceneList') {
				// Simulate a scene collection change happening while the request is in flight
				self.obsState.resetSceneSourceStates()
				return { scenes: [{ sceneName: 'Old Scene', sceneUuid: 'old', sceneIndex: 0 }] }
			}
			return {}
		})

		await self.obs.buildSceneList()

		expect(self.states.scenes.size).toBe(0)
	})

	test('fetchSourcesData discards responses from before a reset', async () => {
		seedSource(self, 'Mic', 'Mic', 'wasapi_input_capture')

		self.socket.callBatch.mockImplementation(async () => {
			// World resets while request in flight, then source is re-seeded.
			self.obsState.resetSceneSourceStates()
			seedSource(self, 'Mic', 'Mic', 'wasapi_input_capture')
			return [
				{
					requestType: 'GetInputMute',
					requestId: 'Mic:mute',
					requestStatus: { result: true, code: 100 },
					responseData: { inputMuted: true },
				},
			]
		})

		await self.obs.fetchSourcesData(['Mic'])

		// The stale mute response must not be applied to the new source
		expect(self.states.sources.get('Mic')!.inputMuted).toBeUndefined()
	})

	test('getSourceFilters discards a stale filter list', async () => {
		seedSource(self, 'Cam', 'Cam', 'dshow_input')
		self.socket.call.mockImplementation(async () => {
			self.obsState.resetSceneSourceStates()
			return { filters: [{ filterName: 'Stale', filterEnabled: true }] }
		})

		await self.obs.getSourceFilters('Cam')

		expect(self.states.sourceFilters.size).toBe(0)
	})
})

describe('input registration from GetInputList', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
	})

	test('buildSceneList registers inputs that are not in any scene, with their kind', async () => {
		self.socket.call.mockImplementation(async (type: string) => {
			if (type === 'GetSceneList') {
				return {
					scenes: [{ sceneName: 'Scene A', sceneUuid: 'scene-a', sceneIndex: 0 }],
					currentProgramSceneName: 'Scene A',
					currentProgramSceneUuid: 'scene-a',
				}
			}
			if (type === 'GetInputList') {
				return {
					inputs: [
						{ inputName: 'Desktop Audio', inputUuid: 'desktop-audio', inputKind: 'coreaudio_output_capture' },
						{ inputName: 'Unplaced Cam', inputUuid: 'unplaced-cam', inputKind: 'av_capture_input' },
					],
				}
			}
			return {}
		})
		self.socket.callBatch.mockResolvedValue([])

		await self.obs.buildSceneList()

		expect(self.states.scenes.get('scene-a')?.sceneName).toBe('Scene A')
		expect(self.states.sources.get('desktop-audio')?.inputKind).toBe('coreaudio_output_capture')
		expect(self.states.sources.get('unplaced-cam')?.inputKind).toBe('av_capture_input')

		// Source data (including audio state) is fetched for the global audio input
		const batches = self.socket.callBatch.mock.calls.map((call) => call[0] as Array<{ requestType: string }>)
		const allRequests = batches.flat()
		expect(
			allRequests.some(
				(req: any) => req.requestType === 'GetInputMute' && req.requestData?.inputUuid === 'desktop-audio',
			),
		).toBe(true)
	})
})

describe('listener state hygiene', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		initOBSListeners(self)
	})

	test('InputRemoved cleans up filters and audio peaks', () => {
		seedSource(self, 'Mic', 'Mic', 'wasapi_input_capture')
		self.states.sourceFilters.set('Mic', [
			{ filterName: 'Gain', filterEnabled: true, filterIndex: 0, filterKind: 'gain_filter', filterSettings: {} },
		])
		self.states.audioPeak.set('Mic', -12)

		self.socket.emit('InputRemoved', { inputName: 'Mic', inputUuid: 'Mic' })

		expect(self.states.sources.has('Mic')).toBe(false)
		expect(self.states.sourceFilters.has('Mic')).toBe(false)
		expect(self.states.audioPeak.has('Mic')).toBe(false)
	})

	test('SceneListChanged refreshes definitions so position variables stay current', () => {
		seedScene(self, 'Scene A')
		seedScene(self, 'Scene B')

		self.socket.emit('SceneListChanged', {
			scenes: [
				{ sceneName: 'Scene B', sceneUuid: 'Scene B', sceneIndex: 0 },
				{ sceneName: 'Scene A', sceneUuid: 'Scene A', sceneIndex: 1 },
			],
		})

		expect(self.states.scenes.get('Scene B')?.sceneIndex).toBe(0)
		expect(self.updateActionsFeedbacksVariables).toHaveBeenCalled()
	})

	test('SceneCreated registers the scene through the shared helper', () => {
		self.socket.emit('SceneCreated', { sceneName: 'New Scene', sceneUuid: 'new-scene', isGroup: false })

		const scene = self.states.scenes.get('new-scene')
		expect(scene?.sceneName).toBe('New Scene')
		expect(self.obsState.findSceneByName('New Scene')).toBe(scene)
	})
})
