import { beforeEach, describe, expect, test, vi } from 'vitest'
import { getSourceFeedbacks } from '../feedbacks/sources.js'
import { initOBSListeners } from '../listeners.js'
import { feedbackEvent } from './mock/events.js'
import { makeMockInstance, sceneItem, seedScene, type MockInstance } from './mock/instance.js'
import { mockBatchResponses } from './mock/socket.js'
import { MockContext } from './mock-context.js'
import { looseFeedbacks } from './loose-definitions.js'

describe('Source - Active in Preview', () => {
	let self: MockInstance

	const check = (source: string): unknown =>
		looseFeedbacks(getSourceFeedbacks(self)).scene_item_previewed.callback(
			feedbackEvent('scene_item_previewed', { source }),
			new MockContext(),
		)

	beforeEach(() => {
		self = makeMockInstance()
		seedScene(self, 'Preview', 'preview')
		seedScene(self, 'Program', 'program')
		seedScene(self, 'Nested', 'nested')
		self.states.studioMode = true
		self.states.previewScene = 'Preview'
		self.states.previewSceneUuid = 'preview'
		self.states.programScene = 'Program'
		self.states.programSceneUuid = 'program'
		self.obs.addSource('camera', 'Camera', 'image_source', false)
		self.obs.addSource('nested', 'Nested', null, false)
		self.obs.addSource('group', 'Group', null, true)
		self.states.sceneItems.set('preview', [
			sceneItem({ sceneItemId: 1, sourceUuid: 'nested', sourceType: 'OBS_SOURCE_TYPE_SCENE' }),
		])
		self.states.sceneItems.set('nested', [sceneItem({ sceneItemId: 2, sourceUuid: 'group', isGroup: true })])
		self.states.sceneItems.set('group', [sceneItem({ sceneItemId: 3, sourceUuid: 'camera' })])
		self.states.sceneItems.set('program', [sceneItem({ sceneItemId: 4, sourceUuid: 'camera' })])
	})

	test.each(['Camera', 'Nested', 'Group'])(
		'recognizes %s through enabled scenes and groups without show events',
		(name) => {
			expect(check(name)).toBe(true)
			expect(self.socket.call).not.toHaveBeenCalled()
			expect(self.socket.callBatch).not.toHaveBeenCalled()
		},
	)

	test.each(['preview', 'nested', 'group'])('a hidden item in %s blocks its descendants', (container) => {
		self.states.sources.get('camera')!.videoShowing = true
		self.states.sceneItems.get(container)![0].sceneItemEnabled = false
		expect(check('Camera')).toBe(false)
	})

	test('a later enabled copy counts even when the first copy is hidden', () => {
		self.states.sceneItems.set('preview', [
			sceneItem({ sceneItemId: 5, sourceUuid: 'camera', sceneItemEnabled: false }),
			sceneItem({ sceneItemId: 6, sourceUuid: 'camera' }),
		])
		expect(check('Camera')).toBe(true)
	})

	test('an enabled nested path counts even when a direct copy is hidden', () => {
		self.states.sceneItems
			.get('preview')!
			.unshift(sceneItem({ sceneItemId: 5, sourceUuid: 'camera', sceneItemEnabled: false }))
		expect(check('Camera')).toBe(true)
	})

	test('a hidden copy of a nested scene does not block another enabled copy', () => {
		self.states.sceneItems.get('preview')!.unshift(
			sceneItem({
				sceneItemId: 5,
				sourceUuid: 'nested',
				sceneItemEnabled: false,
				sourceType: 'OBS_SOURCE_TYPE_SCENE',
			}),
		)
		expect(check('Camera')).toBe(true)
	})

	test('a source shown only in program or another OBS window does not count', () => {
		self.states.sources.get('camera')!.videoShowing = true
		self.states.sources.get('camera')!.active = true
		self.states.sceneItems.set('preview', [])
		expect(check('Camera')).toBe(false)
	})

	test('Studio Mode must be enabled, even if preview state remains cached', () => {
		self.states.sources.get('camera')!.videoShowing = true
		self.states.studioMode = false
		expect(check('Camera')).toBe(false)
	})

	test('an unknown preview scene or source is inactive', () => {
		expect(check('Missing')).toBe(false)
		self.states.sources.get('camera')!.videoShowing = true
		self.states.previewSceneUuid = ''
		expect(check('Camera')).toBe(false)
	})

	test('missing container data is inactive', () => {
		self.states.sources.get('camera')!.videoShowing = true
		self.states.sceneItems.delete('nested')
		expect(check('Camera')).toBe(false)
	})

	test('cycles in cached scene references terminate and still allow other enabled paths', () => {
		self.states.sceneItems.set('nested', [
			sceneItem({ sceneItemId: 5, sourceUuid: 'preview', sourceType: 'OBS_SOURCE_TYPE_SCENE' }),
		])
		expect(check('Camera')).toBe(false)
		self.states.sceneItems.get('nested')!.push(sceneItem({ sceneItemId: 6, sourceUuid: 'camera' }))
		expect(check('Camera')).toBe(true)
	})

	describe('feedback refreshes', () => {
		let displayed: unknown

		beforeEach(() => {
			initOBSListeners(self)
			displayed = null
			self.checkFeedbacks.mockImplementation((...ids: string[]) => {
				if (ids.includes('scene_item_previewed')) displayed = check('Camera')
			})
		})

		test('changing preview updates the button without InputShowStateChanged', () => {
			self.socket.emit('CurrentPreviewSceneChanged', { sceneName: 'Nested', sceneUuid: 'nested' })
			expect(displayed).toBe(true)
			self.states.sceneItems.set('program', [])
			self.socket.emit('CurrentPreviewSceneChanged', { sceneName: 'Program', sceneUuid: 'program' })
			expect(displayed).toBe(false)
		})

		test.each([
			['preview', 1],
			['nested', 2],
			['group', 3],
		])('toggling item %s/%i updates the button immediately in both directions', (sceneUuid, sceneItemId) => {
			// A group's activity request must not delay preview feedback.
			self.socket.call.mockReturnValue(new Promise(() => {}))
			self.socket.emit('SceneItemEnableStateChanged', { sceneUuid, sceneItemId, sceneItemEnabled: false })
			expect(displayed).toBe(false)
			self.socket.emit('SceneItemEnableStateChanged', { sceneUuid, sceneItemId, sceneItemEnabled: true })
			expect(displayed).toBe(true)
		})

		test('enabling and disabling Studio Mode refreshes source preview', async () => {
			self.states.studioMode = false
			self.socket.call.mockResolvedValue({ sceneName: 'Preview', sceneUuid: 'preview' })
			self.socket.emit('StudioModeStateChanged', { studioModeEnabled: true })
			await vi.waitFor(() => expect(displayed).toBe(true))
			self.socket.emit('StudioModeStateChanged', { studioModeEnabled: false })
			expect(displayed).toBe(false)
		})

		test('adding and removing a nested scene refreshes the button', async () => {
			const items = self.states.sceneItems.get('preview')!
			self.states.sceneItems.set('preview', [])
			mockBatchResponses(self.socket, (request) =>
				request.requestType === 'GetSceneItemList' ? { sceneItems: items } : undefined,
			)
			self.socket.emit('SceneItemCreated', { sceneUuid: 'preview', sourceUuid: 'nested', sceneItemId: 1 })
			await vi.waitFor(() => expect(displayed).toBe(true))
			self.socket.emit('SceneItemRemoved', { sceneUuid: 'preview', sourceUuid: 'nested', sceneItemId: 1 })
			expect(displayed).toBe(false)
		})

		test('reloading an empty scene collection clears the feedback', async () => {
			displayed = true
			self.socket.call.mockImplementation(async (type: string) => {
				if (type === 'GetSceneList') {
					return {
						scenes: [{ sceneName: 'Empty', sceneUuid: 'empty', sceneIndex: 0 }],
						currentPreviewSceneName: 'Empty',
						currentPreviewSceneUuid: 'empty',
					}
				}
				return { inputs: [] }
			})
			mockBatchResponses(self.socket, (request) =>
				request.requestType === 'GetSceneItemList' ? { sceneItems: [] } : undefined,
			)
			await self.obs.buildSceneList()
			expect(displayed).toBe(false)
		})
	})
})
