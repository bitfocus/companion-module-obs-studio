import { beforeEach, describe, expect, test } from 'vitest'
import { getSourceFeedbacks } from '../../feedbacks/sources.js'
import { makeMockInstance, sceneItem, seedScene, type MockInstance } from '../mock/instance.js'
import { feedbackEvent } from '../mock/events.js'
import { MockContext } from '../mock-context.js'
import { looseFeedbacks } from '../loose-definitions.js'

describe('scene_item_active_in_scene', () => {
	let self: MockInstance

	const check = (options: { scene: string; any: boolean; source: string }): unknown => {
		const feedbacks = looseFeedbacks(getSourceFeedbacks(self))
		return feedbacks['scene_item_active_in_scene'].callback(
			feedbackEvent('scene_item_active_in_scene', options),
			new MockContext(),
		)
	}

	const seedCopies = (first: boolean, second: boolean) => {
		self.states.sceneItems.set('scene-a', [
			sceneItem({ sceneItemId: 1, sourceUuid: 'src-1', sourceName: 'Camera', sceneItemEnabled: first }),
			sceneItem({ sceneItemId: 2, sourceUuid: 'src-1', sourceName: 'Camera', sceneItemEnabled: second }),
		])
	}

	beforeEach(() => {
		self = makeMockInstance()
		seedScene(self, 'Scene A', 'scene-a')
		self.states.sources.set('src-1', { sourceName: 'Camera', sourceUuid: 'src-1', isGroup: false } as any)
	})

	test('true when the only copy is enabled', () => {
		self.states.sceneItems.set('scene-a', [
			sceneItem({ sceneItemId: 1, sourceUuid: 'src-1', sourceName: 'Camera', sceneItemEnabled: true }),
		])
		expect(check({ scene: 'Scene A', any: false, source: 'Camera' })).toBe(true)
	})

	test('true when a later copy is the enabled one', () => {
		seedCopies(false, true)
		expect(check({ scene: 'Scene A', any: false, source: 'Camera' })).toBe(true)
	})

	test('false only when every copy is disabled', () => {
		seedCopies(false, false)
		expect(check({ scene: 'Scene A', any: false, source: 'Camera' })).toBe(false)
	})

	test('false for a source that is not in the scene', () => {
		seedCopies(true, true)
		expect(check({ scene: 'Scene A', any: false, source: 'Missing' })).toBe(false)
	})
})

describe('scene_item_active', () => {
	let self: MockInstance

	const check = (options: { target: string; scene: string; source: string }): unknown => {
		const feedbacks = looseFeedbacks(getSourceFeedbacks(self))
		return feedbacks['scene_item_active'].callback(feedbackEvent('scene_item_active', options), new MockContext())
	}

	beforeEach(() => {
		self = makeMockInstance()
		seedScene(self, 'Scene A', 'scene-a')
		seedScene(self, 'Scene B', 'scene-b')
		self.states.programScene = 'Scene A'
		self.states.sources.set('src-1', { sourceName: 'Camera', sourceUuid: 'src-1', active: true } as any)
	})

	test('allScenes is true whenever the source is active', () => {
		expect(check({ target: 'allScenes', scene: '', source: 'Camera' })).toBe(true)
	})

	test('a named scene is true only when that scene is on program', () => {
		expect(check({ target: 'scene', scene: 'Scene A', source: 'Camera' })).toBe(true)
		expect(check({ target: 'scene', scene: 'Scene B', source: 'Camera' })).toBe(false)
	})

	test('false when the source is not active, whatever the target', () => {
		self.states.sources.get('src-1')!.active = false
		expect(check({ target: 'allScenes', scene: '', source: 'Camera' })).toBe(false)
		expect(check({ target: 'scene', scene: 'Scene A', source: 'Camera' })).toBe(false)
	})
})
