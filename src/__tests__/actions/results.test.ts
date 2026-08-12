import { beforeEach, describe, expect, test } from 'vitest'
import { getActions } from '../../actions.js'
import { makeMockInstance, seedFullState, type MockInstance } from '../mock/instance.js'
import { actionEvent } from '../mock/events.js'
import { MockContext } from '../mock-context.js'
import { looseActions, type LooseActions } from '../loose-definitions.js'

// Actions that opt into returning a result to a following action in the sequence.
const RESULT_ACTIONS = [
	'custom_command',
	'vendorRequest',
	'toggle_source_mute',
	'toggle_recording',
	'StartStopStreaming',
	'ToggleReplayBuffer',
	'start_stop_output',
	'take_screenshot',
]

describe('action results', () => {
	let self: MockInstance
	let actions: LooseActions

	beforeEach(() => {
		self = makeMockInstance()
		seedFullState(self)
		actions = looseActions(getActions.call(self))
	})

	describe('declares hasResult', () => {
		test.each(RESULT_ACTIONS)('%s', (id) => {
			const def = actions[id]
			expect(def).toBeDefined()
			expect(def.hasResult).toBe(true)
		})
	})

	test('toggle actions return the new boolean state from OBS', async () => {
		self.socket.call.mockResolvedValue({ outputActive: true })
		const streaming = await actions['StartStopStreaming'].callback(
			actionEvent('StartStopStreaming', {}),
			new MockContext(),
		)
		expect(streaming).toBe(true)

		self.socket.call.mockResolvedValue({ inputMuted: false })
		const mute = await actions['toggle_source_mute'].callback(
			actionEvent('toggle_source_mute', { source: 'Mic' }),
			new MockContext(),
		)
		expect(mute).toBe(false)
	})

	test('custom_command returns the raw OBS response', async () => {
		self.socket.call.mockResolvedValue({ someField: 42 })
		const result = await actions['custom_command'].callback(
			actionEvent('custom_command', { command: 'GetVersion', arg: '' }),
			new MockContext(),
		)
		expect(result).toEqual({ someField: 42 })
	})

	test('custom_command returns null on invalid JSON args', async () => {
		const result = await actions['custom_command'].callback(
			actionEvent('custom_command', { command: 'SetCurrentProgramScene', arg: '{not valid json' }),
			new MockContext(),
		)
		expect(result).toBeNull()
	})

	test('vendorRequest returns the vendor responseData', async () => {
		self.socket.call.mockResolvedValue({ responseData: { ok: true } })
		const result = await actions['vendorRequest'].callback(
			actionEvent('vendorRequest', { vendorName: 'x', requestType: 'y', requestData: '' }),
			new MockContext(),
		)
		expect(result).toEqual({ ok: true })
	})

	test('take_screenshot returns the saved file path', async () => {
		self.socket.call.mockResolvedValue({})
		const result = await actions['take_screenshot'].callback(
			actionEvent('take_screenshot', {
				useProgramScene: true,
				format: 'png',
				compression: 0,
				customName: true,
				path: '/tmp/shot.png',
			}),
			new MockContext(),
		)
		expect(result).toBe('/tmp/shot.png')
	})
})
