import { describe, it, expect, beforeEach } from 'vitest'
import { makeMockInstance, type MockInstance } from './mock/instance.js'
import { initOBSListeners } from '../listeners.js'
import { getActions } from '../actions.js'
import { getFeedbacks } from '../feedbacks.js'
import { getVariables } from '../variables.js'
import { looseActions, looseFeedbacks } from './loose-definitions.js'

function seedMassiveState(self: MockInstance, numScenes: number, numSources: number) {
	const s = self.states

	for (let i = 0; i < numScenes; i++) {
		const sceneName = `Scene ${i}`
		s.scenes.set(sceneName, {
			sceneName,
			sceneUuid: sceneName,
			sceneIndex: i,
		})

		const sceneItems = []
		for (let j = 0; j < Math.min(10, numSources); j++) {
			const sourceIndex = (i * 10 + j) % numSources
			const sourceName = `Source ${sourceIndex}`
			sceneItems.push({
				sceneItemId: j,
				sourceName,
				sourceUuid: sourceName,
				sceneItemIndex: j,
				sceneItemLocked: false,
				sceneItemEnabled: true,
				isGroup: false,
				inputKind: 'image_source',
				sourceType: 'OBS_SOURCE_TYPE_INPUT',
			})
		}
		s.sceneItems.set(sceneName, sceneItems)
	}

	for (let i = 0; i < numSources; i++) {
		const sourceName = `Source ${i}`
		s.sources.set(sourceName, {
			sourceName,
			sourceUuid: sourceName,
			validName: sourceName,
			isGroup: false,
			inputKind: i % 2 === 0 ? 'wasapi_input_capture' : 'ffmpeg_source',
		})
	}
}

/**
 * Scale tests: a collection far larger than a realistic one must still be ingested and turned into
 * definitions without dropping entries or throwing. Wall-clock budgets are deliberately not asserted
 * — on a shared CI box they measure the box, not the module.
 */
describe('Load tests', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
	})

	it('ingests a massive scene/input payload without losing entries', async () => {
		const numScenes = 100
		const numSources = 5000

		const mockScenes = Array.from({ length: numScenes }).map((_, i) => ({
			sceneName: `Scene ${i}`,
			sceneUuid: `Scene ${i}`,
			sceneIndex: i,
		}))
		const mockInputs = Array.from({ length: numSources }).map((_, i) => ({
			inputName: `Source ${i}`,
			inputUuid: `Source ${i}`,
			inputKind: i % 2 === 0 ? 'wasapi_input_capture' : 'ffmpeg_source',
			unversionedInputKind: i % 2 === 0 ? 'wasapi_input_capture' : 'ffmpeg_source',
		}))

		self.socket.call.mockImplementation(async (requestType: string) => {
			if (requestType === 'GetSceneList') {
				return { scenes: mockScenes }
			}
			if (requestType === 'GetInputList') {
				return { inputs: mockInputs }
			}
			if (requestType === 'GetSceneItemList') {
				return { sceneItems: [] }
			}
			return {}
		})

		await self.obs.buildSceneList()

		expect(self.states.scenes.size).toBe(numScenes)
		expect(self.states.sources.size).toBe(numSources)
	})

	it('generates a definition per scene and per audio/media source at scale', () => {
		const numScenes = 100
		const numSources = 5000
		seedMassiveState(self, numScenes, numSources)

		const actions = looseActions(getActions.call(self))
		const feedbacks = looseFeedbacks(getFeedbacks.call(self))
		const variables = getVariables.call(self)

		expect(Object.keys(actions).length).toBeGreaterThan(0)
		expect(Object.keys(feedbacks).length).toBeGreaterThan(0)
		// One active-state variable per input, one media-status variable per media input, one
		// position variable per scene.
		expect(Object.keys(variables).filter((id) => id.startsWith('source_active_'))).toHaveLength(numSources)
		expect(Object.keys(variables).filter((id) => id.startsWith('media_status_'))).toHaveLength(numSources / 2)
		expect(variables).toHaveProperty(`scene_${numScenes}`)
	})

	it('survives a high-frequency event stream', () => {
		const numScenes = 10
		const numSources = 50
		seedMassiveState(self, numScenes, numSources)

		initOBSListeners(self)

		for (let i = 0; i < 10000; i++) {
			self.socket.emit('InputVolumeMeters', {
				inputs: [
					{
						inputName: `Source ${i % numSources}`,
						inputUuid: `Source ${i % numSources}`,
						inputLevelsMul: [[0.5, 0.5, 0.5]],
					},
				],
			})
		}

		// Peaks land on the source records the meter events named.
		expect(self.states.sources.get(`Source ${(10000 - 1) % numSources}`)!.peak).toBeDefined()
	})
})
