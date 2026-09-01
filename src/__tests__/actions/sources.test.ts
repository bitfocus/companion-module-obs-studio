import { beforeEach, describe, expect, test } from 'vitest'
import { getSourceActions } from '../../actions/sources.js'
import { makeMockInstance, sceneItem, seedScene, type MockInstance } from '../mock/instance.js'
import { actionEvent } from '../mock/events.js'
import { MockContext } from '../mock-context.js'
import { looseActions } from '../loose-definitions.js'

describe('toggle_scene_item — all sources', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		seedScene(self, 'Scene A', 'scene-a')
		self.states.programScene = 'Scene A'
		self.states.programSceneUuid = 'scene-a'
		self.states.sceneItems.set('scene-a', [
			sceneItem({ sceneItemId: 1, sourceUuid: 'src-1', sourceName: 'Camera', sceneItemEnabled: true }),
			sceneItem({ sceneItemId: 2, sourceUuid: 'src-2', sourceName: 'Overlay', sceneItemEnabled: true }),
			sceneItem({
				sceneItemId: 3,
				sourceUuid: 'src-3',
				sourceName: 'Webcam Group',
				sceneItemEnabled: false,
				isGroup: true,
			}),
		])
	})

	test('hides every item when no except list is given', async () => {
		const actions = looseActions(getSourceActions(self))
		await actions['toggle_scene_item'].callback(
			actionEvent('toggle_scene_item', {
				allSources: true,
				source: [],
				includeGroupChildren: false,
				useCurrentScene: true,
				scene: '',
				except: [],
				visible: 'false',
			}),
			new MockContext(),
		)

		expect(self.socket.callBatch).toHaveBeenCalledTimes(1)
		const batch = self.socket.callBatch.mock.calls[0][0] as Array<{ requestData: any }>
		expect(batch).toHaveLength(3)
		for (const entry of batch) {
			expect(entry.requestData.sceneUuid).toBe('scene-a')
			expect(entry.requestData.sceneItemEnabled).toBe(false)
		}
	})

	test('excepted source is set to the opposite visibility', async () => {
		const actions = looseActions(getSourceActions(self))
		await actions['toggle_scene_item'].callback(
			actionEvent('toggle_scene_item', {
				allSources: true,
				source: [],
				includeGroupChildren: false,
				useCurrentScene: true,
				scene: '',
				except: ['Overlay'],
				visible: 'false',
			}),
			new MockContext(),
		)

		const batch = self.socket.callBatch.mock.calls[0][0] as Array<{ requestData: any }>
		expect(batch).toHaveLength(3)
		const overlay = batch.find((b) => b.requestData.sceneItemId === 2)
		expect(overlay?.requestData.sceneItemEnabled).toBe(true)
		const others = batch.filter((b) => b.requestData.sceneItemId !== 2)
		expect(others.every((b) => b.requestData.sceneItemEnabled === false)).toBe(true)
	})

	test('toggle leaves excepted sources untouched and inverts everything else', async () => {
		const actions = looseActions(getSourceActions(self))
		await actions['toggle_scene_item'].callback(
			actionEvent('toggle_scene_item', {
				allSources: true,
				source: [],
				includeGroupChildren: false,
				useCurrentScene: true,
				scene: '',
				except: ['Overlay'],
				visible: 'toggle',
			}),
			new MockContext(),
		)

		const batch = self.socket.callBatch.mock.calls[0][0] as Array<{ requestData: any }>
		// Overlay (excepted) is not present at all.
		expect(batch.find((b) => b.requestData.sceneItemId === 2)).toBeUndefined()
		expect(batch).toHaveLength(2)
		const camera = batch.find((b) => b.requestData.sceneItemId === 1)
		expect(camera?.requestData.sceneItemEnabled).toBe(false) // was true, toggled
		const group = batch.find((b) => b.requestData.sceneItemId === 3)
		expect(group?.requestData.sceneItemEnabled).toBe(true) // was false, toggled — not recursed into
	})

	test('useCurrentScene resolves via programSceneUuid', async () => {
		seedScene(self, 'Scene B', 'scene-b')
		self.states.sceneItems.set('scene-b', [
			sceneItem({ sceneItemId: 9, sourceUuid: 'src-9', sourceName: 'Other', sceneItemEnabled: true }),
		])

		const actions = looseActions(getSourceActions(self))
		await actions['toggle_scene_item'].callback(
			actionEvent('toggle_scene_item', {
				allSources: true,
				source: [],
				includeGroupChildren: false,
				useCurrentScene: true,
				scene: '',
				except: [],
				visible: 'false',
			}),
			new MockContext(),
		)

		const batch = self.socket.callBatch.mock.calls[0][0] as Array<{ requestData: any }>
		expect(batch.every((b) => b.requestData.sceneUuid === 'scene-a')).toBe(true)
	})

	test('includeGroupChildren descends into group containers', async () => {
		self.states.sources.set('src-3', {
			sourceName: 'Webcam Group',
			sourceUuid: 'src-3',
			isGroup: true,
		} as any)
		self.states.sceneItems.set('src-3', [
			sceneItem({ sceneItemId: 10, sourceUuid: 'src-10', sourceName: 'Child Cam', sceneItemEnabled: true }),
		])

		const actions = looseActions(getSourceActions(self))
		await actions['toggle_scene_item'].callback(
			actionEvent('toggle_scene_item', {
				allSources: true,
				source: [],
				includeGroupChildren: true,
				useCurrentScene: true,
				scene: '',
				except: [],
				visible: 'false',
			}),
			new MockContext(),
		)

		const batch = self.socket.callBatch.mock.calls[0][0] as Array<{ requestData: any }>
		expect(batch).toHaveLength(4)
		const child = batch.find((b) => b.requestData.sceneItemId === 10)
		// The group's own UUID is the container obs-websocket needs for an item inside it.
		expect(child?.requestData.sceneUuid).toBe('src-3')
		expect(child?.requestData.sceneItemEnabled).toBe(false)
	})

	test('a group child can be excepted', async () => {
		self.states.sources.set('src-3', {
			sourceName: 'Webcam Group',
			sourceUuid: 'src-3',
			isGroup: true,
		} as any)
		self.states.sceneItems.set('src-3', [
			sceneItem({ sceneItemId: 10, sourceUuid: 'src-10', sourceName: 'Child Cam', sceneItemEnabled: false }),
		])

		const actions = looseActions(getSourceActions(self))
		await actions['toggle_scene_item'].callback(
			actionEvent('toggle_scene_item', {
				allSources: true,
				source: [],
				includeGroupChildren: true,
				useCurrentScene: true,
				scene: '',
				except: ['Child Cam'],
				visible: 'false',
			}),
			new MockContext(),
		)

		const batch = self.socket.callBatch.mock.calls[0][0] as Array<{ requestData: any }>
		const child = batch.find((b) => b.requestData.sceneItemId === 10)
		expect(child?.requestData.sceneItemEnabled).toBe(true)
		expect(batch.filter((b) => b.requestData.sceneItemId !== 10).every((b) => !b.requestData.sceneItemEnabled)).toBe(
			true,
		)
	})

	test('unknown scene sends no batch', async () => {
		const actions = looseActions(getSourceActions(self))
		await actions['toggle_scene_item'].callback(
			actionEvent('toggle_scene_item', {
				allSources: true,
				source: [],
				includeGroupChildren: false,
				useCurrentScene: false,
				scene: 'Does Not Exist',
				except: [],
				visible: 'false',
			}),
			new MockContext(),
		)

		expect(self.socket.callBatch).not.toHaveBeenCalled()
	})

	test('empty scene sends no batch', async () => {
		seedScene(self, 'Scene C', 'scene-c')
		const actions = looseActions(getSourceActions(self))
		await actions['toggle_scene_item'].callback(
			actionEvent('toggle_scene_item', {
				allSources: true,
				source: [],
				includeGroupChildren: false,
				useCurrentScene: false,
				scene: 'Scene C',
				except: [],
				visible: 'false',
			}),
			new MockContext(),
		)

		expect(self.socket.callBatch).not.toHaveBeenCalled()
	})
})

describe('toggle_scene_item — selected sources', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		seedScene(self, 'Scene A', 'scene-a')
		self.states.programScene = 'Scene A'
		self.states.programSceneUuid = 'scene-a'
		self.states.sources.set('src-1', { sourceName: 'Camera', sourceUuid: 'src-1', isGroup: false } as any)
		self.states.sources.set('src-2', { sourceName: 'Overlay', sourceUuid: 'src-2', isGroup: false } as any)
		self.states.sceneItems.set('scene-a', [
			sceneItem({ sceneItemId: 1, sourceUuid: 'src-1', sourceName: 'Camera', sceneItemEnabled: true }),
			sceneItem({ sceneItemId: 2, sourceUuid: 'src-2', sourceName: 'Overlay', sceneItemEnabled: true }),
		])
	})

	test('several sources are set in a single batch', async () => {
		const actions = looseActions(getSourceActions(self))
		await actions['toggle_scene_item'].callback(
			actionEvent('toggle_scene_item', {
				allSources: false,
				anyScene: false,
				useCurrentScene: true,
				scene: '',
				source: ['Camera', 'Overlay'],
				except: [],
				includeGroupChildren: true,
				visible: 'false',
			}),
			new MockContext(),
		)

		expect(self.socket.callBatch).toHaveBeenCalledTimes(1)
		const batch = self.socket.callBatch.mock.calls[0][0] as Array<{ requestData: any }>
		expect(batch.map((b) => b.requestData.sceneItemId).sort()).toEqual([1, 2])
	})

	test('an empty selection sends no batch', async () => {
		const actions = looseActions(getSourceActions(self))
		await actions['toggle_scene_item'].callback(
			actionEvent('toggle_scene_item', {
				allSources: false,
				anyScene: false,
				useCurrentScene: true,
				scene: '',
				source: [],
				except: [],
				includeGroupChildren: true,
				visible: 'false',
			}),
			new MockContext(),
		)

		expect(self.socket.callBatch).not.toHaveBeenCalled()
	})

	test('a source inside a group targets the group container', async () => {
		self.states.sources.set('src-10', {
			sourceName: 'Child Cam',
			sourceUuid: 'src-10',
			isGroup: false,
			parentGroupUuid: 'src-3',
		} as any)
		self.states.sceneItems.set('src-3', [
			sceneItem({ sceneItemId: 10, sourceUuid: 'src-10', sourceName: 'Child Cam', sceneItemEnabled: false }),
		])

		const actions = looseActions(getSourceActions(self))
		await actions['toggle_scene_item'].callback(
			actionEvent('toggle_scene_item', {
				allSources: false,
				anyScene: true,
				useCurrentScene: false,
				scene: '',
				source: ['Child Cam'],
				except: [],
				includeGroupChildren: true,
				visible: 'true',
			}),
			new MockContext(),
		)

		const batch = self.socket.callBatch.mock.calls[0][0] as Array<{ requestData: any }>
		expect(batch).toEqual([
			{
				requestType: 'SetSceneItemEnabled',
				requestData: { sceneUuid: 'src-3', sceneItemId: 10, sceneItemEnabled: true },
			},
		])
	})
})

describe('toggle_scene_item — a source added to a scene more than once', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		seedScene(self, 'Scene A', 'scene-a')
		self.states.programScene = 'Scene A'
		self.states.programSceneUuid = 'scene-a'
		self.states.sources.set('src-1', { sourceName: 'Camera', sourceUuid: 'src-1', isGroup: false } as any)
		// The same source added twice: one source name, two scene items.
		self.states.sceneItems.set('scene-a', [
			sceneItem({ sceneItemId: 1, sourceUuid: 'src-1', sourceName: 'Camera', sceneItemEnabled: true }),
			sceneItem({ sceneItemId: 2, sourceUuid: 'src-1', sourceName: 'Camera', sceneItemEnabled: false }),
		])
	})

	const run = async (visible: string, anyScene: boolean) => {
		const actions = looseActions(getSourceActions(self))
		await actions['toggle_scene_item'].callback(
			actionEvent('toggle_scene_item', {
				allSources: false,
				anyScene,
				useCurrentScene: !anyScene,
				scene: '',
				source: ['Camera'],
				except: [],
				includeGroupChildren: true,
				visible,
			}),
			new MockContext(),
		)
		return self.socket.callBatch.mock.calls[0][0] as Array<{ requestData: any }>
	}

	test('Hide reaches every copy', async () => {
		const batch = await run('false', false)
		expect(batch.map((b) => b.requestData.sceneItemId).sort()).toEqual([1, 2])
		expect(batch.every((b) => b.requestData.sceneItemEnabled === false)).toBe(true)
	})

	test('Toggle inverts each copy independently', async () => {
		const batch = await run('toggle', false)
		expect(batch.find((b) => b.requestData.sceneItemId === 1)?.requestData.sceneItemEnabled).toBe(false)
		expect(batch.find((b) => b.requestData.sceneItemId === 2)?.requestData.sceneItemEnabled).toBe(true)
	})

	test('All Scenes reaches copies in every scene', async () => {
		seedScene(self, 'Scene B', 'scene-b')
		self.states.sceneItems.set('scene-b', [
			sceneItem({ sceneItemId: 7, sourceUuid: 'src-1', sourceName: 'Camera', sceneItemEnabled: true }),
			sceneItem({ sceneItemId: 8, sourceUuid: 'src-1', sourceName: 'Camera', sceneItemEnabled: true }),
		])

		const batch = await run('false', true)
		expect(batch.map((b) => b.requestData.sceneItemId).sort()).toEqual([1, 2, 7, 8])
	})
})
