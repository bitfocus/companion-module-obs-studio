import { beforeEach, describe, expect, test } from 'vitest'
import { initOBSListeners } from '../listeners.js'
import { getSourceFeedbacks } from '../feedbacks/sources.js'
import { makeMockInstance, sceneItem, seedScene, seedSource, type MockInstance } from './mock/instance.js'
import { mockBatchResponses } from './mock/socket.js'
import { feedbackEvent } from './mock/events.js'
import { MockContext } from './mock-context.js'
import { looseFeedbacks } from './loose-definitions.js'

/** Seed a group source and its own item list of members. */
function seedGroup(self: MockInstance, groupUuid: string, memberUuids: string[]): void {
	self.states.sources.set(groupUuid, {
		sourceName: groupUuid,
		sourceUuid: groupUuid,
		validName: groupUuid,
		isGroup: true,
	})
	// Members live in the group container, keyed by the group's own uuid.
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
		seedGroup(self, 'group-1', ['member-1'])
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
		seedGroup(self, 'group-1', ['member-1'])
	})

	test('scene_item_active_in_scene resolves a grouped source through its group container', () => {
		const feedbacks = looseFeedbacks(getSourceFeedbacks(self))
		const cb = feedbacks['scene_item_active_in_scene'].callback

		// Enabled member matches.
		expect(
			cb(
				feedbackEvent('scene_item_active_in_scene', { scene: 'Scene A', any: false, source: 'member-1' }),
				new MockContext(),
			),
		).toBe(true)

		// Disable in group container and re-check.
		self.states.sceneItems.get('group-1')![0].sceneItemEnabled = false
		expect(
			cb(
				feedbackEvent('scene_item_active_in_scene', { scene: 'Scene A', any: false, source: 'member-1' }),
				new MockContext(),
			),
		).toBe(false)
	})
})

describe('container model — visibility resolution', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		seedScene(self, 'Scene A', 'scene-a')
		seedGroup(self, 'group-1', ['member-1'])
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

describe('removeScene group cleanup', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
	})

	test('removes the group container and its source entry along with the scene', async () => {
		seedScene(self, 'Scene A', 'scene-a')
		self.states.sources.set('group-1', {
			sourceName: 'Group 1',
			sourceUuid: 'group-1',
			validName: 'Group_1',
			isGroup: true,
		})
		self.states.sceneItems.set('scene-a', [sceneItem({ sceneItemId: 1, sourceUuid: 'group-1', isGroup: true })])
		self.states.sceneItems.set('group-1', [sceneItem({ sceneItemId: 10, sourceUuid: 'member-1' })])

		await self.obs.removeScene('scene-a')

		expect(self.states.scenes.has('scene-a')).toBe(false)
		expect(self.states.sceneItems.has('scene-a')).toBe(false)
		expect(self.states.sceneItems.has('group-1')).toBe(false)
		expect(self.states.sources.has('group-1')).toBe(false)
	})
})

describe('groups added after connect', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
	})

	test('addSceneItem fetches the contents of a newly added group', async () => {
		seedScene(self, 'Scene A', 'scene-a')

		// GetSceneItemList for the scene now returns a group item.
		self.socket.call.mockResolvedValue({
			sceneItems: [sceneItem({ sceneItemId: 1, sourceUuid: 'group-1', isGroup: true })],
		})
		mockBatchResponses(self.socket, (request) =>
			request.requestType === 'GetGroupSceneItemList'
				? { sceneItems: [sceneItem({ sceneItemId: 10, sourceUuid: 'member-1' })] }
				: {},
		)

		await self.obs.addSceneItem('scene-a', 'group-1')

		// The group's own item list was requested and cached.
		expect(self.socket.callBatch).toHaveBeenCalledWith(
			[{ requestType: 'GetGroupSceneItemList', requestData: { sceneUuid: 'group-1' }, requestId: expect.any(String) }],
			expect.anything(),
		)
		expect(self.states.sceneItems.get('group-1')).toHaveLength(1)
		expect(self.states.sources.get('member-1')!.parentGroupUuid).toBe('group-1')
	})
})
