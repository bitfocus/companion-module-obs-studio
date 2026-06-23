import { beforeEach, describe, expect, test } from 'vitest'
import type { CompanionFeedbackInfo } from '@companion-module/base'
import { getSceneFeedbacks } from '../../feedbacks/scenes.js'
import { Color } from '../../utils.js'
import { makeMockInstance, seedScene, type MockInstance } from '../mock/instance.js'
import { MockContext } from '../mock-context.js'

function feedback(options: Record<string, unknown>): CompanionFeedbackInfo {
	return { id: 'test', controlId: 'control', feedbackId: 'scene_active', options } as unknown as CompanionFeedbackInfo
}

describe('scene_active feedback', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		seedScene(self, 'Scene A')
		seedScene(self, 'Scene B')
	})

	test('returns program colors when the scene is on program', () => {
		self.states.programScene = 'Scene A'
		const fb = getSceneFeedbacks(self)['scene_active']!

		const result = fb.callback(
			feedback({ mode: 'program', scene: 'Scene A', fg: Color.White, bg: Color.Red }),
			new MockContext(),
		)
		expect(result).toEqual({ color: Color.White, bgcolor: Color.Red })
	})

	test('returns preview colors when the scene is on preview in studio mode', () => {
		self.states.previewScene = 'Scene B'
		self.states.studioMode = true
		const fb = getSceneFeedbacks(self)['scene_active']!

		const result = fb.callback(
			feedback({ mode: 'preview', scene: 'Scene B', fg_preview: Color.White, bg_preview: Color.Green }),
			new MockContext(),
		)
		expect(result).toEqual({ color: Color.White, bgcolor: Color.Green })
	})

	test('returns empty object when the scene is neither program nor preview', () => {
		self.states.programScene = 'Scene A'
		const fb = getSceneFeedbacks(self)['scene_active']!

		const result = fb.callback(feedback({ mode: 'programAndPreview', scene: 'Scene B' }), new MockContext())
		expect(result).toEqual({})
	})
})
