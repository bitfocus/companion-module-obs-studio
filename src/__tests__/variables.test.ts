import { beforeEach, describe, expect, test } from 'vitest'
import { getVariables, updateVariableValues } from '../variables.js'
import { makeMockInstance, seedFullState, type MockInstance } from './mock/instance.js'

describe('variables', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		seedFullState(self)
	})

	test('every variable definition has a non-empty name', () => {
		const variables = getVariables.call(self)
		const ids = Object.keys(variables)
		expect(ids.length).toBeGreaterThan(0)
		for (const id of ids) {
			expect(typeof variables[id].name).toBe('string')
			expect(variables[id].name.length).toBeGreaterThan(0)
		}
	})

	test('source- and scene-specific variables are generated from state', () => {
		const variables = getVariables.call(self)
		// Audio source -> volume var, media source -> status var, text -> text var, image -> file var
		expect(variables).toHaveProperty('volume_Mic')
		expect(variables).toHaveProperty('media_status_Clip')
		expect(variables).toHaveProperty('current_text_Title')
		expect(variables).toHaveProperty('image_file_name_Logo')
		expect(variables).toHaveProperty('scene_1')
	})

	test('updateVariableValues only sets variables that are defined', () => {
		const defined = new Set(Object.keys(getVariables.call(self)))

		updateVariableValues.call(self)

		expect(self.setVariableValues).toHaveBeenCalledTimes(1)
		const updates = self.setVariableValues.mock.calls[0][0] as Record<string, unknown>
		const undefinedVars = Object.keys(updates).filter((key) => !defined.has(key))
		expect(undefinedVars).toEqual([])
	})

	test('updateVariableValues reflects seeded scene state', () => {
		updateVariableValues.call(self)
		const updates = self.setVariableValues.mock.calls[0][0] as Record<string, unknown>
		expect(updates.scene_active).toBe('Scene A')
		expect(updates.scene_preview).toBe('Scene B')
	})

	test('transition and audio source lists are sorted arrays', () => {
		self.states.transitions.set('Cut', {
			transitionName: 'Cut',
			transitionUuid: 'Cut',
			transitionType: 'cut_transition',
			transitionFixed: true,
			transitionConfigurable: false,
		})
		// Game Capture style source: reports volume but no audio tracks, still counts as audio.
		self.states.sources.set('Game', {
			sourceName: 'Game',
			sourceUuid: 'Game',
			validName: 'Game',
			isGroup: false,
			inputKind: 'game_capture',
			inputVolume: 0,
		})

		updateVariableValues.call(self)
		const updates = self.setVariableValues.mock.calls[0][0] as Record<string, unknown>

		expect(updates.transition_list).toEqual(['Cut', 'Fade'])
		// 'Title' (text) and 'Logo' (image) have no audio, so they're excluded.
		expect(updates.audio_source_list).toEqual(['Game', 'Mic'])
	})

	// These variables are written both here and by event handlers in listeners.ts / api.ts. The two
	// paths have drifted apart before (a unit suffix on one side, a number on the other), leaving the
	// value's type dependent on which handler ran last.
	test('values that have a second writer keep their type', () => {
		self.states.transitionActive = true
		self.states.sources.get('Mic')!.inputAudioSyncOffset = 250
		self.states.sources.get('Clip')!.active = true

		updateVariableValues.call(self)
		const updates = self.setVariableValues.mock.calls[0][0] as Record<string, unknown>

		expect(updates.volume_Mic).toBe(0)
		expect(updates.sync_offset_Mic).toBe(250)
		expect(updates.transition_active).toBe(true)
		expect(updates.source_active_Clip).toBe(true)
		expect(updates.mute_Mic).toBe('Unmuted')
		expect(updates.media_status_Clip).toBe('Playing')
	})

	test('studio_mode, virtualcam_active and replay_buffer_active reflect state', () => {
		self.states.studioMode = true
		self.states.replayBuffer = true
		self.states.outputs.set('virtualcam_output', { outputName: 'virtualcam_output', outputActive: true })

		updateVariableValues.call(self)
		const updates = self.setVariableValues.mock.calls[0][0] as Record<string, unknown>

		expect(updates.studio_mode).toBe(true)
		expect(updates.replay_buffer_active).toBe(true)
		expect(updates.virtualcam_active).toBe(true)
	})

	test('virtualcam_active defaults to false before the virtualcam output is known', () => {
		updateVariableValues.call(self)
		const updates = self.setVariableValues.mock.calls[0][0] as Record<string, unknown>

		expect(updates.virtualcam_active).toBe(false)
	})

	test('tracks_<source> lists the active audio mixer tracks as numbers', () => {
		self.states.sources.get('Mic')!.inputAudioTracks = { '1': false, '2': true, '3': true }

		updateVariableValues.call(self)
		const updates = self.setVariableValues.mock.calls[0][0] as Record<string, unknown>

		expect(updates.tracks_Mic).toEqual([2, 3])
	})
})
