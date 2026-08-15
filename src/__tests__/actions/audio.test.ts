import { beforeEach, describe, expect, test } from 'vitest'
import { getAudioActions } from '../../actions/audio.js'
import { ObsAudioMonitorType } from '../../types.js'
import { makeMockInstance, seedSource, type MockInstance } from '../mock/instance.js'
import { actionEvent } from '../mock/events.js'
import { MockContext } from '../mock-context.js'
import { looseActions } from '../loose-definitions.js'

describe('set_audio_tracks', () => {
	let self: MockInstance

	const run = async (options: { source: string; tracks: string[]; value: string }) => {
		const actions = looseActions(getAudioActions(self))
		await actions['set_audio_tracks'].callback(actionEvent('set_audio_tracks', options), new MockContext())
	}

	beforeEach(() => {
		self = makeMockInstance()
		seedSource(self, 'Mic')
		self.states.sources.get('Mic')!.inputAudioTracks = { '1': true, '2': false, '3': true }
	})

	test('enables only the selected tracks', async () => {
		await run({ source: 'Mic', tracks: ['2', '3'], value: 'true' })

		expect(self.socket.call).toHaveBeenCalledWith('SetInputAudioTracks', {
			inputName: 'Mic',
			inputAudioTracks: { '2': true, '3': true },
		})
	})

	test('disables only the selected tracks', async () => {
		await run({ source: 'Mic', tracks: ['1'], value: 'false' })

		expect(self.socket.call).toHaveBeenCalledWith('SetInputAudioTracks', {
			inputName: 'Mic',
			inputAudioTracks: { '1': false },
		})
	})

	test('toggles each selected track from its current state', async () => {
		await run({ source: 'Mic', tracks: ['1', '2'], value: 'toggle' })

		expect(self.socket.call).toHaveBeenCalledWith('SetInputAudioTracks', {
			inputName: 'Mic',
			inputAudioTracks: { '1': false, '2': true },
		})
	})

	test('affects every known track when no tracks are selected', async () => {
		await run({ source: 'Mic', tracks: [], value: 'toggle' })

		expect(self.socket.call).toHaveBeenCalledWith('SetInputAudioTracks', {
			inputName: 'Mic',
			inputAudioTracks: { '1': false, '2': true, '3': false },
		})
	})

	test('ignores tracks the source does not report', async () => {
		await run({ source: 'Mic', tracks: ['3', '6'], value: 'false' })

		expect(self.socket.call).toHaveBeenCalledWith('SetInputAudioTracks', {
			inputName: 'Mic',
			inputAudioTracks: { '3': false },
		})
	})

	test('sends nothing when no selected track exists', async () => {
		await run({ source: 'Mic', tracks: ['5', '6'], value: 'true' })

		expect(self.socket.call).not.toHaveBeenCalled()
	})

	test('sends nothing for an unknown source', async () => {
		await run({ source: 'Nope', tracks: ['1'], value: 'true' })

		expect(self.socket.call).not.toHaveBeenCalled()
	})

	test('sends nothing when the source has no audio tracks', async () => {
		seedSource(self, 'Camera')

		await run({ source: 'Camera', tracks: ['1'], value: 'true' })

		expect(self.socket.call).not.toHaveBeenCalled()
	})
})

describe('set_audio_monitor', () => {
	let self: MockInstance

	const run = async (monitor: string, source = 'Mic') => {
		const actions = looseActions(getAudioActions(self))
		await actions['set_audio_monitor'].callback(
			actionEvent('set_audio_monitor', { source, monitor }),
			new MockContext(),
		)
	}

	beforeEach(() => {
		self = makeMockInstance()
		seedSource(self, 'Mic')
		self.states.sources.get('Mic')!.monitorType = ObsAudioMonitorType.None
	})

	test('enabling monitoring sets monitor and output', async () => {
		await run('true')

		expect(self.socket.call).toHaveBeenCalledWith('SetInputAudioMonitorType', {
			inputName: 'Mic',
			monitorType: ObsAudioMonitorType.MonitorAndOutput,
		})
	})

	test('disabling monitoring sets the monitor type to none', async () => {
		self.states.sources.get('Mic')!.monitorType = ObsAudioMonitorType.MonitorAndOutput
		await run('false')

		expect(self.socket.call).toHaveBeenCalledWith('SetInputAudioMonitorType', {
			inputName: 'Mic',
			monitorType: ObsAudioMonitorType.None,
		})
	})

	test.each([
		[ObsAudioMonitorType.None, ObsAudioMonitorType.MonitorAndOutput],
		// The legacy monitor-only type counts as monitoring on, so a toggle turns it off.
		[ObsAudioMonitorType.MonitorOnly, ObsAudioMonitorType.None],
		[ObsAudioMonitorType.MonitorAndOutput, ObsAudioMonitorType.None],
	])('toggling from %s sends %s', async (current, expected) => {
		self.states.sources.get('Mic')!.monitorType = current
		await run('toggle')

		expect(self.socket.call).toHaveBeenCalledWith('SetInputAudioMonitorType', {
			inputName: 'Mic',
			monitorType: expected,
		})
	})

	test('toggling an unknown source enables monitoring', async () => {
		await run('toggle', 'Nope')

		expect(self.socket.call).toHaveBeenCalledWith('SetInputAudioMonitorType', {
			inputName: 'Nope',
			monitorType: ObsAudioMonitorType.MonitorAndOutput,
		})
	})

	test.each([
		[ObsAudioMonitorType.None, 'false'],
		[ObsAudioMonitorType.MonitorOnly, 'true'],
		[ObsAudioMonitorType.MonitorAndOutput, 'true'],
	])('learns %s as %s', (current, expected) => {
		self.states.sources.get('Mic')!.monitorType = current
		const actions = looseActions(getAudioActions(self))

		const learned = actions['set_audio_monitor'].learn!(
			actionEvent('set_audio_monitor', { source: 'Mic', monitor: 'toggle' }),
			new MockContext(),
		)
		expect(learned).toEqual({ monitor: expected })
	})
})
