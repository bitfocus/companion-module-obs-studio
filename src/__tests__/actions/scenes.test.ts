import { beforeEach, describe, expect, test } from 'vitest'
import { getSceneActions } from '../../actions/scenes.js'
import { makeMockInstance, seedScene, type MockInstance } from '../mock/instance.js'
import { actionEvent } from '../mock/events.js'
import { MockContext } from '../mock-context.js'
import { looseActions } from '../loose-definitions.js'

describe('scene actions', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		seedScene(self, 'Scene A')
		seedScene(self, 'Scene B')
	})

	test('set_scene sends SetCurrentProgramScene with the chosen scene', async () => {
		const actions = looseActions(getSceneActions(self))
		await actions['set_scene'].callback(actionEvent('set_scene', { scene: 'Scene B' }), new MockContext())

		expect(self.socket.call).toHaveBeenCalledWith('SetCurrentProgramScene', { sceneName: 'Scene B' })
	})

	test('preview_scene sends SetCurrentPreviewScene with the chosen scene', async () => {
		const actions = looseActions(getSceneActions(self))
		await actions['preview_scene'].callback(actionEvent('preview_scene', { scene: 'Scene A' }), new MockContext())

		expect(self.socket.call).toHaveBeenCalledWith('SetCurrentPreviewScene', { sceneName: 'Scene A' })
	})

	test('set_scene learns the current program scene', () => {
		self.states.programScene = 'Scene A'
		const actions = looseActions(getSceneActions(self))

		const learned = actions['set_scene'].learn!(actionEvent('set_scene', {}), new MockContext())
		expect(learned).toEqual({ scene: 'Scene A' })
	})

	test('set_scene learn returns undefined when no program scene is set', () => {
		const actions = looseActions(getSceneActions(self))
		const learned = actions['set_scene'].learn!(actionEvent('set_scene', {}), new MockContext())
		expect(learned).toBeUndefined()
	})
})
