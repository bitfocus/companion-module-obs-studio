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

describe('Load & Performance Tests', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
	})

	it('should parse massive websocket payload quickly', async () => {
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
			if (requestType === 'GetSourceActive') {
				return { videoActive: true, videoShowing: true }
			}
			if (requestType === 'GetRecordStatus') {
				return {
					outputActive: false,
					outputPaused: false,
					outputTimecode: '00:00:00.000',
					outputDuration: 0,
					outputBytes: 0,
				}
			}
			return {}
		})

		const start = performance.now()

		await self.obs.buildSceneList()

		const end = performance.now()
		const duration = end - start

		console.log(`Parsing ${numScenes} scenes and ${numSources} inputs via buildSceneList took ${duration.toFixed(2)}ms`)

		expect(duration).toBeLessThan(1000)

		expect(self.states.scenes.size).toBe(numScenes)
	})

	it('should generate actions, feedbacks, variables within reasonable time and memory', () => {
		const numScenes = 100
		const numSources = 5000
		seedMassiveState(self, numScenes, numSources)

		const heapBefore = process.memoryUsage().heapUsed
		const start = performance.now()

		const actions = looseActions(getActions.call(self))
		const feedbacks = looseFeedbacks(getFeedbacks.call(self))
		const variables = getVariables.call(self)

		self.setActionDefinitions(actions)
		self.setFeedbackDefinitions(feedbacks)
		self.setVariableDefinitions(variables)

		const end = performance.now()
		const heapAfter = process.memoryUsage().heapUsed

		const duration = end - start
		const heapDiffMB = (heapAfter - heapBefore) / 1024 / 1024

		console.log(
			`Generating definitions with ${numScenes} scenes and ${numSources} sources took ${duration.toFixed(2)}ms`,
		)
		console.log(`Memory heap difference: ${heapDiffMB.toFixed(2)} MB`)

		expect(duration).toBeLessThan(1000)
		expect(heapDiffMB).toBeLessThan(50)
	})

	it('should handle high-frequency events rapidly', () => {
		const numScenes = 10
		const numSources = 50
		seedMassiveState(self, numScenes, numSources)

		initOBSListeners(self)

		const start = performance.now()
		// Fire 10000 events
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
		const end = performance.now()
		const duration = end - start

		console.log(`Processing 10,000 InputVolumeMeters events took ${duration.toFixed(2)}ms`)

		expect(duration).toBeLessThan(500)
	})
})
