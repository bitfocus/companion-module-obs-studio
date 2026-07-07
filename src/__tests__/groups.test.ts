import { beforeEach, describe, expect, test } from 'vitest'
import type { CompanionFeedbackBooleanEvent } from '@companion-module/base'
import { initOBSListeners } from '../listeners.js'
import { getSourceFeedbacks } from '../feedbacks/sources.js'
import { makeMockInstance, seedScene, seedSource, type MockInstance } from './mock/instance.js'
import { MockContext } from './mock-context.js'
import type { OBSSceneItem } from '../types.js'

function feedbackEvent(options: Record<string, unknown>): CompanionFeedbackBooleanEvent {
	return {
		id: 'fb',
		feedbackId: 'scene_item_active_in_scene',
		controlId: 'c',
		options,
	} as unknown as CompanionFeedbackBooleanEvent
}

function sceneItem(partial: Partial<OBSSceneItem> & { sceneItemId: number; sourceUuid: string }): OBSSceneItem {
	return {
		sourceName: partial.sourceUuid,
		sceneItemIndex: 0,
		sceneItemLocked: false,
		sceneItemEnabled: true,
		isGroup: false,
		inputKind: null,
		sourceType: 'OBS_SOURCE_TYPE_INPUT',
		...partial,
	}
}

/** Seed a group source plus its membership in a scene and its own item list. */
function seedGroup(self: MockInstance, groupUuid: string, sceneUuid: string, memberUuids: string[]): void {
	self.states.sources.set(groupUuid, {
		sourceName: groupUuid,
		sourceUuid: groupUuid,
		validName: groupUuid,
		isGroup: true,
	})
	// The group is an item in the scene, and its members live in the group container.
	self.states.sceneItems.set(
		groupUuid,
		memberUuids.map((uuid, i) => sceneItem({ sceneItemId: 200 + i, sourceUuid: uuid })),
	)
	for (const uuid of memberUuids) {
		seedSource(self, uuid, uuid)
		self.states.sources.get(uuid)!.parentGroupUuid = groupUuid
	}
}

describe('container model — scene item creation routing', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		initOBSListeners(self)
	})

	test('SceneItemCreated inside a group uses GetGroupSceneItemList, not GetSceneItemList', async () => {
		seedGroup(self, 'group-1', 'scene-a', ['member-1'])
		self.socket.call.mockResolvedValue({
			sceneItems: [
				{ sceneItemId: 200, sourceUuid: 'member-1', sourceName: 'member-1', sceneItemEnabled: true },
				{ sceneItemId: 201, sourceUuid: 'member-2', sourceName: 'member-2', sceneItemEnabled: true },
			],
		})

		await self.obs.addSceneItem('group-1', 'member-2')

		expect(self.socket.call).toHaveBeenCalledWith('GetGroupSceneItemList', { sceneUuid: 'group-1' })
		expect(self.socket.call).not.toHaveBeenCalledWith('GetSceneItemList', { sceneUuid: 'group-1' })
		// New member registered with parent group.
		expect(self.states.sources.get('member-2')?.parentGroupUuid).toBe('group-1')
	})

	test('SceneItemCreated inside a plain scene uses GetSceneItemList', async () => {
		seedScene(self, 'Scene A', 'scene-a')
		self.socket.call.mockResolvedValue({ sceneItems: [] })

		await self.obs.addSceneItem('scene-a', 'src-1')

		expect(self.socket.call).toHaveBeenCalledWith('GetSceneItemList', { sceneUuid: 'scene-a' })
	})
})

describe('container model — grouped source feedback', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		seedScene(self, 'Scene A', 'scene-a')
		seedGroup(self, 'group-1', 'scene-a', ['member-1'])
	})

	test('scene_item_active_in_scene resolves a grouped source through its group container', () => {
		const feedbacks = getSourceFeedbacks(self)
		const cb = feedbacks['scene_item_active_in_scene']!.callback

		// Enabled member matches.
		expect(cb(feedbackEvent({ scene: 'Scene A', any: false, source: 'member-1' }), new MockContext())).toBe(true)

		// Disable in group container and re-check.
		self.states.sceneItems.get('group-1')![0].sceneItemEnabled = false
		expect(cb(feedbackEvent({ scene: 'Scene A', any: false, source: 'member-1' }), new MockContext())).toBe(false)
	})
})

describe('container model — visibility resolution', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		seedScene(self, 'Scene A', 'scene-a')
		seedGroup(self, 'group-1', 'scene-a', ['member-1'])
	})

	test('toggling a grouped source (any scene) targets the group container', async () => {
		await self.obs.setSourceVisibility('member-1', 'toggle', {
			anyScene: true,
			useCurrentScene: false,
			scene: '',
		})

		expect(self.socket.callBatch).toHaveBeenCalledTimes(1)
		const batch = self.socket.callBatch.mock.calls[0][0] as Array<{ requestData: any }>
		expect(batch).toHaveLength(1)
		expect(batch[0].requestData.sceneUuid).toBe('group-1')
		expect(batch[0].requestData.sceneItemId).toBe(200)
		// Toggle enabled member to disabled.
		expect(batch[0].requestData.sceneItemEnabled).toBe(false)
	})

	test('toggling a grouped source in a specific scene resolves via parentGroupUuid', async () => {
		await self.obs.setSourceVisibility('member-1', 'true', {
			anyScene: false,
			useCurrentScene: false,
			scene: 'Scene A',
		})

		const batch = self.socket.callBatch.mock.calls[0][0] as Array<{ requestData: any }>
		expect(batch).toHaveLength(1)
		expect(batch[0].requestData.sceneUuid).toBe('group-1')
		expect(batch[0].requestData.sceneItemEnabled).toBe(true)
	})
})
