import { beforeEach, describe, expect, test } from 'vitest'
import { initOBSListeners } from './listeners.js'
import { makeMockInstance, seedScene, type MockInstance } from './__tests__/mock/instance.js'

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
