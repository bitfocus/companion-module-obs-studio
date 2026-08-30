import { beforeEach, describe, expect, test } from 'vitest'
import { getSceneFeedbacks } from '../../feedbacks/scenes.js'
import { makeMockInstance, seedScene, type MockInstance } from '../mock/instance.js'
import { feedbackEvent } from '../mock/events.js'
import { MockContext } from '../mock-context.js'
import { looseFeedbacks } from '../loose-definitions.js'

describe('scene program / preview feedbacks', () => {
	let self: MockInstance

	const check = (id: 'sceneProgram' | 'scenePreview', scene: string): unknown => {
		const feedbacks = looseFeedbacks(getSceneFeedbacks(self))
		return feedbacks[id].callback(feedbackEvent(id, { scene }), new MockContext())
	}

	beforeEach(() => {
		self = makeMockInstance()
		seedScene(self, 'Scene A')
		seedScene(self, 'Scene B')
		self.states.programScene = 'Scene A'
		self.states.previewScene = 'Scene B'
		self.states.studioMode = true
	})

	test('sceneProgram is true for the program scene', () => {
		expect(check('sceneProgram', 'Scene A')).toBe(true)
	})

	test('sceneProgram is false for a scene that is not on program', () => {
		expect(check('sceneProgram', 'Scene B')).toBe(false)
	})

	test('scenePreview is true for the preview scene', () => {
		expect(check('scenePreview', 'Scene B')).toBe(true)
	})

	test('scenePreview is false for a scene that is not on preview', () => {
		expect(check('scenePreview', 'Scene A')).toBe(false)
	})
})
