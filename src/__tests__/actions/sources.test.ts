import { beforeEach, describe, expect, test } from 'vitest'
import { getSourceActions } from '../../actions/sources.js'
import { makeMockInstance, sceneItem, seedScene, type MockInstance } from '../mock/instance.js'
import { actionEvent } from '../mock/events.js'
import { MockContext } from '../mock-context.js'
import { looseActions } from '../loose-definitions.js'

describe('toggle_all_scene_items', () => {
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
		await actions['toggle_all_scene_items'].callback(
			actionEvent('toggle_all_scene_items', { useCurrentScene: true, scene: '', except: [], visible: 'false' }),
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
		await actions['toggle_all_scene_items'].callback(
			actionEvent('toggle_all_scene_items', {
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
		await actions['toggle_all_scene_items'].callback(
			actionEvent('toggle_all_scene_items', {
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
		await actions['toggle_all_scene_items'].callback(
			actionEvent('toggle_all_scene_items', { useCurrentScene: true, scene: '', except: [], visible: 'false' }),
			new MockContext(),
		)

		const batch = self.socket.callBatch.mock.calls[0][0] as Array<{ requestData: any }>
		expect(batch.every((b) => b.requestData.sceneUuid === 'scene-a')).toBe(true)
	})

	test('unknown scene sends no batch', async () => {
		const actions = looseActions(getSourceActions(self))
		await actions['toggle_all_scene_items'].callback(
			actionEvent('toggle_all_scene_items', {
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
		await actions['toggle_all_scene_items'].callback(
			actionEvent('toggle_all_scene_items', { useCurrentScene: false, scene: 'Scene C', except: [], visible: 'false' }),
			new MockContext(),
		)

		expect(self.socket.callBatch).not.toHaveBeenCalled()
	})
})
