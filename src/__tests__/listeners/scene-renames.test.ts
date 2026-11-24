import { beforeEach, describe, expect, test } from 'vitest'
import { getSceneFeedbacks } from '../../feedbacks/scenes.js'
import { initOBSListeners } from '../../listeners.js'
import { updateVariableValues } from '../../variables.js'
import { looseFeedbacks } from '../loose-definitions.js'
import { MockContext } from '../mock-context.js'
import { feedbackEvent } from '../mock/events.js'
import { makeMockInstance, sceneItem, seedScene, seedSource, type MockInstance } from '../mock/instance.js'
import { lastBatch } from '../mock/socket.js'

describe('scene rename propagation', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		seedScene(self, 'Scene A', 'scene-a')
		self.updateActionsFeedbacksVariables.mockImplementation(() => updateVariableValues.call(self, new Map()))
		initOBSListeners(self)
	})

	test.each([
		{ name: 'programScene', uuid: 'programSceneUuid', variable: 'scene_active', feedback: 'sceneProgram' },
		{ name: 'previewScene', uuid: 'previewSceneUuid', variable: 'scene_preview', feedback: 'scenePreview' },
		{ name: 'previousScene', uuid: 'previousSceneUuid', variable: 'scene_previous', feedback: 'scenePrevious' },
	] as const)('updates the $variable variable and its feedback', async ({ name, uuid, variable, feedback }) => {
		self.states[name] = 'Scene A'
		self.states[uuid] = 'scene-a'

		self.socket.emit('SceneNameChanged', { sceneUuid: 'scene-a', oldSceneName: 'Scene A', sceneName: 'Intro' })

		expect(self.setVariableValues).toHaveBeenCalledWith(expect.objectContaining({ [variable]: 'Intro' }))
		const feedbacks = looseFeedbacks(getSceneFeedbacks(self))
		expect(
			await feedbacks[feedback].callback(feedbackEvent(feedback, { scene: 'Intro' }), new MockContext('feedback')),
		).toBe(true)
		expect(
			await feedbacks[feedback].callback(feedbackEvent(feedback, { scene: 'Scene A' }), new MockContext('feedback')),
		).toBe(false)
		expect(self.states[uuid]).toBe('scene-a')
	})

	test('updates every selected role with the renamed UUID and leaves other scenes alone', () => {
		self.states.programScene = self.states.previewScene = 'Scene A'
		self.states.programSceneUuid = self.states.previewSceneUuid = 'scene-a'
		self.states.previousScene = 'Scene B'
		self.states.previousSceneUuid = 'scene-b'

		self.socket.emit('SceneNameChanged', { sceneUuid: 'scene-a', oldSceneName: 'Scene A', sceneName: 'Intro' })

		expect(self.setVariableValues).toHaveBeenCalledWith(
			expect.objectContaining({ scene_active: 'Intro', scene_preview: 'Intro', scene_previous: 'Scene B' }),
		)
	})

	test('refreshes the source name index and variables for a scene used as a source', () => {
		seedSource(self, 'Scene A', 'scene-a')
		const source = self.states.sources.get('scene-a')!
		source.active = true
		expect(self.obsState.findSourceByName('Scene A')).toBe(source)
		expect(self.obsState.findSceneByName('Scene A')).toBeDefined()

		self.socket.emit('SceneNameChanged', { sceneUuid: 'scene-a', oldSceneName: 'Scene A', sceneName: 'Intro Scene' })

		expect(self.obsState.findSourceByName('Intro Scene')).toBe(source)
		expect(self.obsState.findSourceByName('Scene A')).toBeUndefined()
		expect(self.obsState.findSceneByName('Intro Scene')?.sceneUuid).toBe('scene-a')
		expect(self.obsState.sourceChoices).toContainEqual({ id: 'Intro Scene', label: 'Intro Scene' })
		expect(self.setVariableValues).toHaveBeenCalledWith(expect.objectContaining({ source_active_Intro_Scene: true }))
	})

	test('keeps renamed nested scene copies in the visibility exception list', async () => {
		seedScene(self, 'Main', 'main')
		self.states.sceneItems.set('main', [
			sceneItem({ sceneItemId: 1, sourceUuid: 'scene-a', sourceName: 'Scene A', sourceType: 'OBS_SOURCE_TYPE_SCENE' }),
			sceneItem({ sceneItemId: 2, sourceUuid: 'scene-a', sourceName: 'Scene A', sourceType: 'OBS_SOURCE_TYPE_SCENE' }),
			sceneItem({ sceneItemId: 3, sourceUuid: 'camera', sourceName: 'Camera' }),
		])

		self.socket.emit('SceneNameChanged', { sceneUuid: 'scene-a', oldSceneName: 'Scene A', sceneName: 'Intro' })
		await self.obs.setAllSourcesVisibility('true', {
			target: 'scene',
			scene: 'Main',
			group: '',
			except: ['Intro'],
			includeGroupChildren: 'groups',
		})

		expect(lastBatch(self.socket).map((request) => request.requestData)).toEqual([
			{ sceneUuid: 'main', sceneItemId: 3, sceneItemEnabled: true },
			{ sceneUuid: 'main', sceneItemId: 1, sceneItemEnabled: false },
			{ sceneUuid: 'main', sceneItemId: 2, sceneItemEnabled: false },
		])
	})

	test('does not register an unknown scene or source from a rename event', () => {
		self.socket.emit('SceneNameChanged', { sceneUuid: 'unknown', oldSceneName: 'Unknown', sceneName: 'Intro' })

		expect(self.states.scenes.has('unknown')).toBe(false)
		expect(self.states.sources.size).toBe(0)
	})
})
