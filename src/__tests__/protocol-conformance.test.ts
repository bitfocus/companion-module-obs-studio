import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { CompanionActionEvent, CompanionOptionValues } from '@companion-module/base'
import { getActions } from '../actions.js'
import { initOBSListeners } from '../listeners.js'
import { makeMockInstance, seedFullState, seedScene, seedSource, type MockInstance } from './mock/instance.js'
import { MockContext } from './mock-context.js'
import { mockBatchResponses } from './mock/socket.js'
import type { OBSBatchRequest, OBSSceneItem } from '../types.js'
import { SLEEP_MAX_MS } from '../constants.js'
import { looseActions, type LooseActions } from './loose-definitions.js'

function event(actionId: string, options: CompanionOptionValues): CompanionActionEvent {
	return { id: 'test', controlId: 'control', actionId, options } as unknown as CompanionActionEvent
}

/** Batch entries as sent to callBatch by the most recent call. */
function lastBatch(self: MockInstance): OBSBatchRequest[] {
	const calls = self.socket.callBatch.mock.calls
	return calls[calls.length - 1][0] as OBSBatchRequest[]
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

describe('fadeVolume batch', () => {
	let self: MockInstance
	let actions: LooseActions

	beforeEach(() => {
		self = makeMockInstance()
		seedFullState(self)
		// The fade reads the starting volume from OBS rather than from module state.
		self.socket.call.mockResolvedValue({ inputVolumeDb: 0 })
		actions = looseActions(getActions.call(self))
	})

	test('delays steps with Sleep requests rather than a non-protocol sleep field', async () => {
		await actions['fadeVolume'].callback(
			event('fadeVolume', { source: 'Mic', volume: -10, duration: 200 }),
			new MockContext(),
		)

		const batch = lastBatch(self)
		const volumeSteps = batch.filter((r) => r.requestType === 'SetInputVolume')
		const sleeps = batch.filter((r) => r.requestType === 'Sleep')

		expect(volumeSteps).toHaveLength(4)
		expect(sleeps).toHaveLength(3)
		expect(sleeps[0].requestData).toEqual({ sleepMillis: 50 })
		// A `sleep` key on a request is silently ignored by obs-websocket.
		expect(batch.some((r) => 'sleep' in r)).toBe(false)
	})

	test('ends on the target volume', async () => {
		await actions['fadeVolume'].callback(
			event('fadeVolume', { source: 'Mic', volume: -10, duration: 200 }),
			new MockContext(),
		)

		const steps = lastBatch(self).filter((r) => r.requestType === 'SetInputVolume')
		expect(steps[steps.length - 1].requestData).toEqual({ inputName: 'Mic', inputVolumeDb: -10 })
	})

	test('still emits a step when the duration is shorter than one step', async () => {
		await actions['fadeVolume'].callback(
			event('fadeVolume', { source: 'Mic', volume: -10, duration: 10 }),
			new MockContext(),
		)

		const steps = lastBatch(self).filter((r) => r.requestType === 'SetInputVolume')
		expect(steps).toHaveLength(1)
		expect(steps[0].requestData).toEqual({ inputName: 'Mic', inputVolumeDb: -10 })
	})

	test('fades from the volume OBS reports, not the cached one', async () => {
		self.states.sources.get('Mic')!.inputVolume = -60
		self.socket.call.mockResolvedValue({ inputVolumeDb: 0 })

		await actions['fadeVolume'].callback(
			event('fadeVolume', { source: 'Mic', volume: -10, duration: 200 }),
			new MockContext(),
		)

		const steps = lastBatch(self).filter((r) => r.requestType === 'SetInputVolume')
		expect(steps[0].requestData).toEqual({ inputName: 'Mic', inputVolumeDb: -2.5 })
	})

	test('does nothing when the current volume cannot be read', async () => {
		self.socket.call.mockResolvedValue({})

		await actions['fadeVolume'].callback(
			event('fadeVolume', { source: 'Ghost', volume: -10, duration: 200 }),
			new MockContext(),
		)

		expect(self.socket.callBatch).not.toHaveBeenCalled()
	})

	test('ignores a second fade for the same source while one is in flight', async () => {
		let releaseBatch: (value: unknown) => void = () => {}
		self.socket.callBatch.mockImplementation(async () => new Promise((resolve) => (releaseBatch = resolve)))

		// Fired in the same tick: the guard must be claimed before the first await, not after it.
		const first = actions['fadeVolume'].callback(
			event('fadeVolume', { source: 'Mic', volume: -10, duration: 200 }),
			new MockContext(),
		)
		const second = actions['fadeVolume'].callback(
			event('fadeVolume', { source: 'Mic', volume: 0, duration: 200 }),
			new MockContext(),
		)

		await vi.waitFor(() => expect(self.socket.callBatch).toHaveBeenCalledTimes(1))
		await second
		expect(self.socket.callBatch).toHaveBeenCalledTimes(1)

		releaseBatch([])
		await first

		// Once the batch finishes the source can be faded again.
		self.socket.callBatch.mockResolvedValue([])
		await actions['fadeVolume'].callback(
			event('fadeVolume', { source: 'Mic', volume: 0, duration: 200 }),
			new MockContext(),
		)
		expect(self.socket.callBatch).toHaveBeenCalledTimes(2)
	})
})

describe('quick_transition Sleep', () => {
	let self: MockInstance
	let actions: LooseActions

	beforeEach(() => {
		self = makeMockInstance()
		seedFullState(self)
		actions = looseActions(getActions.call(self))
	})

	test('clamps sleepMillis to the protocol maximum', async () => {
		await actions['quick_transition'].callback(
			event('quick_transition', { transition: 'Fade', customDuration: true, transition_time: 60000 }),
			new MockContext(),
		)

		const sleep = lastBatch(self).find((r) => r.requestType === 'Sleep')
		expect(sleep!.requestData).toEqual({ sleepMillis: SLEEP_MAX_MS })
	})
})

describe('input default settings', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
	})

	test('merges the kind defaults under the values OBS reports', () => {
		seedSource(self, 'Title', 'Title', 'text_gdiplus_v2')
		self.states.inputKindList.set('text_gdiplus_v2', {
			font: { face: 'Arial', size: 36 },
			color: 0xffffff,
			text: '',
		})

		self.obs.buildInputSettings('Title', 'text_gdiplus_v2', { text: 'Hello' })

		expect(self.states.sources.get('Title')!.settings).toEqual({
			font: { face: 'Arial', size: 36 },
			color: 0xffffff,
			text: 'Hello',
		})
	})

	test('falls back to the reported settings when the kind has no defaults', () => {
		seedSource(self, 'Title', 'Title', 'text_gdiplus_v2')

		self.obs.buildInputSettings('Title', 'text_gdiplus_v2', { text: 'Hello' })

		expect(self.states.sources.get('Title')!.settings).toEqual({ text: 'Hello' })
	})
})

describe('custom_command variables', () => {
	let self: MockInstance
	let actions: LooseActions

	beforeEach(() => {
		self = makeMockInstance()
		seedFullState(self)
		actions = looseActions(getActions.call(self))
	})

	test('records the request type, data and response', async () => {
		self.socket.call.mockResolvedValue({ sceneName: 'Scene A' })

		await actions['custom_command'].callback(
			event('custom_command', { command: 'GetCurrentProgramScene', arg: '{"a":1}' }),
			new MockContext(),
		)

		expect(self.setVariableValues).toHaveBeenCalledWith({
			custom_command_type: 'GetCurrentProgramScene',
			custom_command_request: '{"a":1}',
			custom_command_response: '{"sceneName":"Scene A"}',
		})
	})

	test('clears the request and response variables when the request fails', async () => {
		self.socket.call.mockRejectedValue(new Error('nope'))

		await actions['custom_command'].callback(
			event('custom_command', { command: 'GetCurrentProgramScene', arg: '' }),
			new MockContext(),
		)

		expect(self.setVariableValues).toHaveBeenCalledWith({
			custom_command_request: '',
			custom_command_response: '',
		})
	})
})

describe('recording_path variable', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
	})

	test('is set from the GetRecordDirectory response', async () => {
		self.socket.call.mockResolvedValue({ recordDirectory: '/Users/test/Movies' })

		await self.obs.getRecordDirectory()

		expect(self.socket.call).toHaveBeenCalledWith('GetRecordDirectory', undefined)
		expect(self.states.recordDirectory).toBe('/Users/test/Movies')
		expect(self.setVariableValues).toHaveBeenCalledWith({ recording_path: '/Users/test/Movies' })
	})
})

describe('scene filters', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
	})

	test('fetchSceneFilters stores filters keyed by scene UUID', async () => {
		seedScene(self, 'Scene A', 'scene-a')
		mockBatchResponses(self.socket, () => ({
			filters: [
				{
					filterName: 'Color',
					filterEnabled: true,
					filterIndex: 0,
					filterKind: 'color_filter',
					filterSettings: {},
				},
			],
		}))

		await self.obs.fetchSceneFilters(['scene-a'])

		expect(lastBatch(self)).toEqual([
			{ requestType: 'GetSourceFilterList', requestData: { sourceUuid: 'scene-a' }, requestId: expect.any(String) },
		])
		expect(self.states.sourceFilters.get('scene-a')).toHaveLength(1)
	})

	test('a scene filter is resolvable by name and surfaces in the filter list', () => {
		seedScene(self, 'Scene A', 'scene-a')
		self.states.sourceFilters.set('scene-a', [
			{ filterName: 'Color', filterEnabled: true, filterIndex: 0, filterKind: 'color_filter', filterSettings: {} },
		])

		expect(self.obsState.findFilterTargetUuid('Scene A')).toBe('scene-a')
		expect(self.obsState.findSourceFiltersByName('Scene A')).toHaveLength(1)
		expect(self.obsState.filterList.map((f) => f.id)).toContain('Color')
	})

	test('SourceFilterEnableStateChanged on a scene updates the cached filter', () => {
		initOBSListeners(self)
		seedScene(self, 'Scene A', 'scene-a')
		self.states.sourceFilters.set('scene-a', [
			{ filterName: 'Color', filterEnabled: true, filterIndex: 0, filterKind: 'color_filter', filterSettings: {} },
		])

		self.socket.emit('SourceFilterEnableStateChanged', {
			sourceName: 'Scene A',
			filterName: 'Color',
			filterEnabled: false,
		})

		expect(self.states.sourceFilters.get('scene-a')![0].filterEnabled).toBe(false)
		expect(self.checkFeedbacks).toHaveBeenCalledWith('filter_enabled')
	})

	test('setFilterVisibility targets a scene by name', async () => {
		seedScene(self, 'Scene A', 'scene-a')
		self.states.sourceFilters.set('scene-a', [
			{ filterName: 'Color', filterEnabled: true, filterIndex: 0, filterKind: 'color_filter', filterSettings: {} },
		])

		await self.obs.setFilterVisibility('Color', 'toggle', { allSources: false, source: 'Scene A' })

		expect(self.socket.call).toHaveBeenCalledWith('SetSourceFilterEnabled', {
			sourceUuid: 'scene-a',
			filterName: 'Color',
			filterEnabled: false,
		})
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
