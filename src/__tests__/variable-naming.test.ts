import { beforeEach, describe, expect, test } from 'vitest'
import { initOBSListeners } from '../listeners.js'
import { getVariables, updateVariableValues } from '../variables.js'
import { ObsAudioMonitorType, OBSMediaInputAction } from '../types.js'
import { makeMockInstance, type MockInstance } from './mock/instance.js'

/**
 * Companion variable names are derived from the source's name, never its UUID — a UUID in a
 * variable name is unusable on a button and changes when OBS regenerates it.
 *
 * Most seed helpers give a source the same string for both, which would hide a leak, so everything
 * here uses a UUID that shares no substring with the name.
 */
const UUID = '7f3a1c2e-0000-4b6d-9e11-abcdefabcdef'
const NAME = 'Front Camera'
const VALID_NAME = 'Front_Camera'

/** Every variable name published through `setVariableValues` during the test. */
function publishedNames(self: MockInstance): string[] {
	return self.setVariableValues.mock.calls.flatMap(([values]) => Object.keys(values as Record<string, unknown>))
}

describe('variable names never contain a source UUID', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		// Registered the way OBS reports it: a UUID key with a human-readable name.
		self.obs.addSource(UUID, NAME, 'ffmpeg_source')
		Object.assign(self.states.sources.get(UUID)!, {
			inputMuted: false,
			inputVolume: 0,
			inputAudioBalance: 0.5,
			inputAudioSyncOffset: 0,
			monitorType: ObsAudioMonitorType.None,
			inputAudioTracks: { '1': true },
			settings: { local_file: '/media/clip.mp4' },
		})
		initOBSListeners(self)
	})

	test('addSource derives validName from the name, not the UUID', () => {
		expect(self.states.sources.get(UUID)!.validName).toBe(VALID_NAME)
	})

	test('the generated variable definitions are keyed by name', () => {
		const ids = Object.keys(getVariables.call(self))

		expect(ids).toContain(`volume_${VALID_NAME}`)
		expect(ids).toContain(`media_status_${VALID_NAME}`)
		expect(ids.filter((id) => id.includes(UUID))).toEqual([])
	})

	test('the bulk variable publish uses names', () => {
		updateVariableValues.call(self)

		expect(publishedNames(self).filter((name) => name.includes(UUID))).toEqual([])
	})

	test.each([
		['InputMuteStateChanged', { inputMuted: true }],
		['InputVolumeChanged', { inputVolumeMul: 0.5, inputVolumeDb: -6 }],
		['InputAudioBalanceChanged', { inputAudioBalance: 0.7 }],
		['InputAudioSyncOffsetChanged', { inputAudioSyncOffset: 250 }],
		['InputAudioMonitorTypeChanged', { monitorType: ObsAudioMonitorType.MonitorAndOutput }],
		['InputAudioTracksChanged', { inputAudioTracks: { '1': false, '2': true } }],
		['InputActiveStateChanged', { videoActive: true }],
		['InputSettingsChanged', { inputSettings: { local_file: '/media/other.mp4' } }],
		['MediaInputPlaybackStarted', {}],
		['MediaInputPlaybackEnded', {}],
		['MediaInputActionTriggered', { mediaAction: OBSMediaInputAction.Pause }],
	])('%s publishes name-keyed variables only', (event, payload) => {
		self.socket.emit(event, { inputName: NAME, inputUuid: UUID, ...payload })

		const names = publishedNames(self)
		expect(names.length).toBeGreaterThan(0)
		expect(names.filter((name) => name.includes(UUID))).toEqual([])
		// And they are actually keyed by the sanitized name, not merely UUID-free.
		expect(names.some((name) => name.endsWith(VALID_NAME))).toBe(true)
	})

	test('a rename repoints the variables at the new name', () => {
		self.socket.emit('InputNameChanged', { inputUuid: UUID, oldInputName: NAME, inputName: 'Wide Shot' })
		self.setVariableValues.mockClear()

		self.socket.emit('InputMuteStateChanged', { inputName: 'Wide Shot', inputUuid: UUID, inputMuted: true })

		expect(publishedNames(self)).toEqual(['mute_Wide_Shot'])
	})
})
