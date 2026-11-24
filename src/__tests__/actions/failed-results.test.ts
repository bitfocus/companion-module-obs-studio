import { beforeEach, describe, expect, test } from 'vitest'
import { getActions } from '../../actions.js'
import { looseActions, type LooseActions } from '../loose-definitions.js'
import { MockContext } from '../mock-context.js'
import { actionEvent } from '../mock/events.js'
import { makeMockInstance, seedFullState, type MockInstance } from '../mock/instance.js'

describe('action results follow the OBS request outcome', () => {
	let self: MockInstance
	let actions: LooseActions

	beforeEach(() => {
		self = makeMockInstance()
		seedFullState(self)
		actions = looseActions(getActions.call(self))
	})

	describe.each([
		{ id: 'recording', options: {}, start: 'StartRecord', stop: 'StopRecord', data: undefined },
		{ id: 'streaming', options: {}, start: 'StartStream', stop: 'StopStream', data: undefined },
		{ id: 'replay_buffer', options: {}, start: 'StartReplayBuffer', stop: 'StopReplayBuffer', data: undefined },
		{
			id: 'output',
			options: { output: 'Decklink' },
			start: 'StartOutput',
			stop: 'StopOutput',
			data: { outputName: 'Decklink' },
		},
		{
			id: 'output',
			options: { output: 'virtualcam_output' },
			start: 'StartVirtualCam',
			stop: 'StopVirtualCam',
			data: undefined,
		},
	])('$start / $stop', ({ id, options, start, stop, data }) => {
		test.each(['start', 'stop'])('returns null when OBS rejects %s', async (action) => {
			self.socket.call.mockRejectedValue(new Error('Output request rejected'))

			const result = await actions[id].callback(actionEvent(id, { ...options, action }), new MockContext())

			expect(self.socket.call).toHaveBeenCalledWith(action === 'start' ? start : stop, data)
			expect(result).toBeNull()
		})

		test.each(['start', 'stop'])('returns the requested state after successful %s', async (action) => {
			self.socket.call.mockResolvedValue(
				action === 'stop' && stop === 'StopRecord' ? { outputPath: '/recordings/show.mkv' } : undefined,
			)

			const result = await actions[id].callback(actionEvent(id, { ...options, action }), new MockContext())

			expect(self.socket.call).toHaveBeenCalledWith(action === 'start' ? start : stop, data)
			expect(result).toBe(action === 'start')
		})
	})

	describe.each(['true', 'false'])('mute=%s', (mute) => {
		test('returns null when OBS rejects the mute request', async () => {
			self.socket.call.mockRejectedValue(new Error('Input no longer exists'))

			const result = await actions.mute.callback(actionEvent('mute', { source: 'Mic', mute }), new MockContext())

			expect(self.socket.call).toHaveBeenCalledWith('SetInputMute', { inputName: 'Mic', inputMuted: mute === 'true' })
			expect(result).toBeNull()
		})

		test('returns the requested mute state after a successful request', async () => {
			self.socket.call.mockResolvedValue(undefined)

			const result = await actions.mute.callback(actionEvent('mute', { source: 'Mic', mute }), new MockContext())

			expect(result).toBe(mute === 'true')
		})
	})

	describe.each([
		{ enabled: 'true', current: false, requested: true },
		{ enabled: 'false', current: true, requested: false },
		{ enabled: 'toggle', current: true, requested: false },
		{ enabled: 'toggle', current: false, requested: true },
	])('Studio Mode=$enabled from $current', ({ enabled, current, requested }) => {
		test('returns null when OBS rejects the Studio Mode request', async () => {
			self.states.studioMode = current
			self.socket.call.mockRejectedValue(new Error('Studio Mode request rejected'))

			const result = await actions.studio_mode.callback(actionEvent('studio_mode', { enabled }), new MockContext())

			expect(self.socket.call).toHaveBeenCalledWith('SetStudioModeEnabled', { studioModeEnabled: requested })
			expect(result).toBeNull()
		})

		test('returns the requested Studio Mode state after a successful request', async () => {
			self.states.studioMode = current
			self.socket.call.mockResolvedValue(undefined)

			const result = await actions.studio_mode.callback(actionEvent('studio_mode', { enabled }), new MockContext())

			expect(result).toBe(requested)
		})
	})

	describe('screenshot', () => {
		const options = {
			target: 'programScene',
			format: 'png',
			compression: 0,
			customName: true,
			path: '/captures/shot.png',
		}

		test('returns the saved path when OBS succeeds without response data', async () => {
			self.socket.call.mockResolvedValue(undefined)

			const result = await actions.take_screenshot.callback(actionEvent('take_screenshot', options), new MockContext())

			expect(self.socket.call).toHaveBeenCalledWith('SaveSourceScreenshot', {
				sourceName: 'Scene A',
				imageFormat: 'png',
				imageFilePath: '/captures/shot.png',
				imageCompressionQuality: -1,
			})
			expect(result).toBe('/captures/shot.png')
		})

		test('returns null when OBS rejects the screenshot request', async () => {
			self.socket.call.mockRejectedValue(new Error('Cannot save screenshot'))

			const result = await actions.take_screenshot.callback(actionEvent('take_screenshot', options), new MockContext())

			expect(result).toBeNull()
		})
	})
})
