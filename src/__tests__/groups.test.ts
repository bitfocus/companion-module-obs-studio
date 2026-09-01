import { beforeEach, describe, expect, test } from 'vitest'
import { initOBSListeners } from '../listeners.js'
import { getSourceFeedbacks } from '../feedbacks/sources.js'
import { makeMockInstance, sceneItem, seedScene, seedSource, type MockInstance } from './mock/instance.js'
import { mockBatchResponses } from './mock/socket.js'
import { feedbackEvent } from './mock/events.js'
import { MockContext } from './mock-context.js'
import { looseFeedbacks } from './loose-definitions.js'

/** Every request issued across all batches, flattened — container fetches are batched. */
function batchedRequests(self: MockInstance): Array<{ requestType: string; requestData?: unknown }> {
	return self.socket.callBatch.mock.calls.flatMap(
		(call) => call[0] as Array<{ requestType: string; requestData?: unknown }>,
	)
}

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
		mockBatchResponses(self.socket, (request) =>
			request.requestType === 'GetGroupSceneItemList'
				? {
						sceneItems: [
							sceneItem({ sceneItemId: 200, sourceUuid: 'member-1' }),
							sceneItem({ sceneItemId: 201, sourceUuid: 'member-2' }),
						],
					}
				: {},
		)

		await self.obs.addSceneItem('group-1', 'member-2')

		const requests = batchedRequests(self)
		expect(requests).toContainEqual(
			expect.objectContaining({ requestType: 'GetGroupSceneItemList', requestData: { sceneUuid: 'group-1' } }),
		)
		expect(requests).not.toContainEqual(
			expect.objectContaining({ requestType: 'GetSceneItemList', requestData: { sceneUuid: 'group-1' } }),
		)
		// New member registered with parent group.
		expect(self.states.sources.get('member-2')?.parentGroupUuid).toBe('group-1')
	})

	test('SceneItemCreated inside a plain scene uses GetSceneItemList', async () => {
		seedScene(self, 'Scene A', 'scene-a')
		mockBatchResponses(self.socket, () => ({ sceneItems: [] }))

		await self.obs.addSceneItem('scene-a', 'src-1')

		expect(batchedRequests(self)).toContainEqual(
			expect.objectContaining({ requestType: 'GetSceneItemList', requestData: { sceneUuid: 'scene-a' } }),
		)
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
			target: 'allScenes',
			scene: '',
			group: '',
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
			target: 'scene',
			scene: 'Scene A',
			group: '',
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

		// The scene's item list now returns a group item, whose own contents are fetched in a second round.
		mockBatchResponses(self.socket, (request) => {
			if (request.requestType === 'GetSceneItemList')
				return { sceneItems: [sceneItem({ sceneItemId: 1, sourceUuid: 'group-1', isGroup: true })] }
			if (request.requestType === 'GetGroupSceneItemList')
				return { sceneItems: [sceneItem({ sceneItemId: 10, sourceUuid: 'member-1' })] }
			return {}
		})

		await self.obs.addSceneItem('scene-a', 'group-1')

		// The group's own item list was requested and cached.
		expect(batchedRequests(self)).toContainEqual(
			expect.objectContaining({ requestType: 'GetGroupSceneItemList', requestData: { sceneUuid: 'group-1' } }),
		)
		expect(self.states.sceneItems.get('group-1')).toHaveLength(1)
		expect(self.states.sources.get('member-1')!.parentGroupUuid).toBe('group-1')
	})
})

describe('scene item lookup precedence', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		seedScene(self, 'Scene A', 'scene-a')
		seedScene(self, 'Scene B', 'scene-b')
		seedGroup(self, 'group-1', ['member-1'])
		// The group lives in Scene A; the same source is also added directly to Scene B.
		self.states.sceneItems.set('scene-a', [sceneItem({ sceneItemId: 1, sourceUuid: 'group-1', isGroup: true })])
		self.states.sceneItems.set('scene-b', [sceneItem({ sceneItemId: 50, sourceUuid: 'member-1' })])
	})

	test('the targeted scene wins over the parent group when it holds the source itself', () => {
		const match = self.obsState.findSceneItemByName('Scene B', 'member-1')

		expect(match).toEqual({ containerUuid: 'scene-b', item: expect.objectContaining({ sceneItemId: 50 }) })
	})

	test('falls back to the parent group when the scene does not hold the source directly', () => {
		const match = self.obsState.findSceneItemByName('Scene A', 'member-1')

		expect(match).toEqual({ containerUuid: 'group-1', item: expect.objectContaining({ sceneItemId: 200 }) })
	})

	test('returns undefined for an unknown scene or source', () => {
		expect(self.obsState.findSceneItemByName('Nope', 'member-1')).toBeUndefined()
		expect(self.obsState.findSceneItemByName('Scene A', 'nope')).toBeUndefined()
	})

	test('findSceneItemsAnywhere reports every container holding the source', () => {
		const containers = self.obsState.findSceneItemsAnywhere('member-1').map((m) => m.containerUuid)

		expect(containers.sort()).toEqual(['group-1', 'scene-b'])
	})

	test('setSourceVisibility targets the scene copy, not the group copy', async () => {
		await self.obs.setSourceVisibility('member-1', 'false', {
			target: 'scene',
			scene: 'Scene B',
			group: '',
		})

		const batch = self.socket.callBatch.mock.calls[0][0] as Array<{ requestData: any }>
		expect(batch).toHaveLength(1)
		expect(batch[0].requestData.sceneUuid).toBe('scene-b')
		expect(batch[0].requestData.sceneItemId).toBe(50)
	})

	test('scene_item_active_in_scene reports the targeted scene copy', () => {
		// Group copy enabled, Scene B copy disabled: a group-first lookup would answer true.
		self.states.sceneItems.get('scene-b')![0].sceneItemEnabled = false
		const feedbacks = looseFeedbacks(getSourceFeedbacks(self))

		const result = feedbacks['scene_item_active_in_scene'].callback(
			feedbackEvent('scene_item_active_in_scene', { scene: 'Scene B', any: false, source: 'member-1' }),
			new MockContext(),
		)

		expect(result).toBe(false)
	})
})

describe('duplicate scene item lookups', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		seedScene(self, 'Scene A', 'scene-a')
		seedSource(self, 'Camera', 'src-1')
		self.states.sceneItems.set('scene-a', [
			sceneItem({ sceneItemId: 1, sourceUuid: 'src-1', sourceName: 'Camera', sceneItemEnabled: true }),
			sceneItem({ sceneItemId: 2, sourceUuid: 'src-1', sourceName: 'Camera', sceneItemEnabled: false }),
		])
	})

	test('findSceneItems returns every copy, findSceneItem still returns one', () => {
		expect(self.obsState.findSceneItems('scene-a', 'src-1').map((m) => m.item.sceneItemId)).toEqual([1, 2])
		expect(self.obsState.findSceneItem('scene-a', 'src-1')?.item.sceneItemId).toBe(1)
	})

	test('the scene beats the parent group when it holds the source itself', () => {
		self.states.sources.get('src-1')!.parentGroupUuid = 'group-1'
		self.states.sceneItems.set('group-1', [
			sceneItem({ sceneItemId: 99, sourceUuid: 'src-1', sourceName: 'Camera', sceneItemEnabled: true }),
		])

		const matches = self.obsState.findSceneItems('scene-a', 'src-1')
		expect(matches.every((m) => m.containerUuid === 'scene-a')).toBe(true)
		expect(matches).toHaveLength(2)
	})

	test('the parent group is used when the scene does not hold the source', () => {
		self.states.sources.get('src-1')!.parentGroupUuid = 'group-1'
		self.states.sceneItems.set('scene-a', [])
		self.states.sceneItems.set('group-1', [
			sceneItem({ sceneItemId: 99, sourceUuid: 'src-1', sourceName: 'Camera', sceneItemEnabled: true }),
		])

		expect(self.obsState.findSceneItems('scene-a', 'src-1')).toEqual([
			{ containerUuid: 'group-1', item: expect.objectContaining({ sceneItemId: 99 }) },
		])
	})

	test('findSceneItemsAnywhere collects every copy in every container', () => {
		seedScene(self, 'Scene B', 'scene-b')
		self.states.sceneItems.set('scene-b', [
			sceneItem({ sceneItemId: 7, sourceUuid: 'src-1', sourceName: 'Camera', sceneItemEnabled: true }),
		])

		expect(
			self.obsState
				.findSceneItemsAnywhere('src-1')
				.map((m) => m.item.sceneItemId)
				.sort(),
		).toEqual([1, 2, 7])
	})
})
