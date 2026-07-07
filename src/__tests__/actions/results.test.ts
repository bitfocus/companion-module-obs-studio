import { beforeEach, describe, expect, test } from 'vitest'
import type { CompanionActionDefinition, CompanionActionEvent, CompanionOptionValues } from '@companion-module/base'
import { getActions } from '../../actions.js'
import { makeMockInstance, seedFullState, type MockInstance } from '../mock/instance.js'
import { MockContext } from '../mock-context.js'

function event(actionId: string, options: CompanionOptionValues): CompanionActionEvent {
	return { id: 'test', controlId: 'control', actionId, options } as unknown as CompanionActionEvent
}

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
	let actions: ReturnType<typeof getActions>

	beforeEach(() => {
		self = makeMockInstance()
		seedFullState(self)
		actions = getActions.call(self)
	})

	describe('declares hasResult', () => {
		test.each(RESULT_ACTIONS)('%s', (id) => {
			const def = actions[id] as CompanionActionDefinition & { hasResult?: boolean }
			expect(def).toBeDefined()
			expect(def.hasResult).toBe(true)
		})
	})

	test('toggle actions return the new boolean state from OBS', async () => {
		self.socket.call.mockResolvedValue({ outputActive: true })
		const streaming = await actions['StartStopStreaming']!.callback(event('StartStopStreaming', {}), new MockContext())
		expect(streaming).toBe(true)

		self.socket.call.mockResolvedValue({ inputMuted: false })
		const mute = await actions['toggle_source_mute']!.callback(
			event('toggle_source_mute', { source: 'Mic' }),
			new MockContext(),
		)
		expect(mute).toBe(false)
	})

	test('custom_command returns the raw OBS response', async () => {
		self.socket.call.mockResolvedValue({ someField: 42 })
		const result = await actions['custom_command']!.callback(
			event('custom_command', { command: 'GetVersion', arg: '' }),
			new MockContext(),
		)
		expect(result).toEqual({ someField: 42 })
	})

	test('custom_command returns null on invalid JSON args', async () => {
		const result = await actions['custom_command']!.callback(
			event('custom_command', { command: 'SetCurrentProgramScene', arg: '{not valid json' }),
			new MockContext(),
		)
		expect(result).toBeNull()
	})

	test('vendorRequest returns the vendor responseData', async () => {
		self.socket.call.mockResolvedValue({ responseData: { ok: true } })
		const result = await actions['vendorRequest']!.callback(
			event('vendorRequest', { vendorName: 'x', requestType: 'y', requestData: '' }),
			new MockContext(),
		)
		expect(result).toEqual({ ok: true })
	})

	test('take_screenshot returns the saved file path', async () => {
		self.socket.call.mockResolvedValue({})
		const result = await actions['take_screenshot']!.callback(
			event('take_screenshot', {
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
