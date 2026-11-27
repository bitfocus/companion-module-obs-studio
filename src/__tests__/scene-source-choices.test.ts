import { describe, expect, test } from 'vitest'
import { sceneSourceChoices } from '../actions/options.js'
import { getSourceActions } from '../actions/sources.js'
import { getSourceFeedbacks } from '../feedbacks/sources.js'
import { makeMockInstance, sceneItem, seedScene, seedSource } from './mock/instance.js'

describe('scene-scoped source suggestions', () => {
	test('includes direct and grouped membership, with unknown and unloaded scenes falling back', () => {
		const self = makeMockInstance()
		seedScene(self, 'Live "A"', 'live')
		seedScene(self, 'Empty', 'empty')
		seedScene(self, 'Loading', 'loading')
		seedSource(self, 'Camera', 'camera')
		seedSource(self, 'Group', 'group')
		seedSource(self, 'Overlay', 'overlay')
		seedSource(self, 'Unused', 'unused')
		self.states.sceneItems.set('live', [
			sceneItem({ sceneItemId: 1, sourceUuid: 'camera' }),
			sceneItem({ sceneItemId: 2, sourceUuid: 'group', isGroup: true }),
		])
		self.states.sceneItems.set('group', [sceneItem({ sceneItemId: 3, sourceUuid: 'overlay' })])
		self.states.sceneItems.set('empty', [])
		const choices = sceneSourceChoices(self, 'target')
		for (const choice of choices) {
			expect(choice.isVisibleExpression).toContain("$(options:target) != 'scene' || ")
			expect(choice.isVisibleExpression).toContain('!arrayIncludes(["Empty","Live \\"A\\""], $(options:scene))')
			expect(choice.isVisibleExpression).toContain(
				`|| arrayIncludes(${choice.id === 'Unused' ? '[]' : '["Live \\"A\\""]'}, $(options:scene))`,
			)
		}
		self.states.sceneItems.set('empty', [sceneItem({ sceneItemId: 4, sourceUuid: 'camera' })])
		const updated = sceneSourceChoices(self, 'scene')
		expect(updated.find((choice) => choice.id === 'Camera')?.isVisibleExpression).toContain('["Empty","Live \\"A\\""]')
	})

	test('applies to visibility sources and exceptions, properties, and scene feedbacks', () => {
		const self = makeMockInstance()
		seedSource(self, 'Camera')
		const actions = getSourceActions(self)
		const feedbacks = getSourceFeedbacks(self)
		for (const [definition, ids] of [
			[actions.toggle_scene_item, ['source', 'except']],
			[actions.source_properties, ['source']],
			[feedbacks.scene_item_active, ['source']],
			[feedbacks.scene_item_active_in_scene, ['source']],
		] as const) {
			if (!definition) throw new Error('Missing definition')
			for (const id of ids) {
				const option = definition?.options.find((option) => option.id === id)
				expect(option).toHaveProperty('choices.0.isVisibleExpression')
			}
		}
	})
})
