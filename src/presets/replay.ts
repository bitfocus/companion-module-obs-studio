import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import type { OBSInstanceTypes } from '../main.js'
import { baseStyle, styleActive } from './style.js'

/** Replay buffer control + status presets. */
export function getReplayPresets(_self: OBSInstance): {
	presets: CompanionPresetDefinitions<OBSInstanceTypes>
	sections: CompanionPresetSection<OBSInstanceTypes>[]
} {
	const presets: CompanionPresetDefinitions<OBSInstanceTypes> = {}

	presets['replayToggle'] = {
		type: 'simple',
		name: 'Toggle Replay Buffer',
		previewStyle: baseStyle({ text: 'TOGGLE\nREPLAY' }),
		style: baseStyle({ text: 'START\nREPLAY' }),
		steps: [{ down: [{ actionId: 'ToggleReplayBuffer', options: {} }], up: [] }],
		feedbacks: [{ feedbackId: 'replayBufferActive', options: {}, style: { ...styleActive(), text: 'STOP\nREPLAY' } }],
	}

	presets['replayStart'] = {
		type: 'simple',
		name: 'Start Replay Buffer',
		style: baseStyle({ text: 'START\nREPLAY' }),
		steps: [{ down: [{ actionId: 'start_replay_buffer', options: {} }], up: [] }],
		feedbacks: [],
	}

	presets['replayStop'] = {
		type: 'simple',
		name: 'Stop Replay Buffer',
		style: baseStyle({ text: 'STOP\nREPLAY' }),
		steps: [{ down: [{ actionId: 'stop_replay_buffer', options: {} }], up: [] }],
		feedbacks: [],
	}

	presets['replaySave'] = {
		type: 'simple',
		name: 'Save Replay Buffer',
		style: baseStyle({ text: 'SAVE\nREPLAY' }),
		steps: [{ down: [{ actionId: 'save_replay_buffer', options: {} }], up: [] }],
		feedbacks: [],
	}

	presets['replayStatus'] = {
		type: 'simple',
		name: 'Replay Buffer Status',
		style: baseStyle({ text: 'REPLAY\nBUFFER STATUS' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [{ feedbackId: 'replayBufferActive', options: {}, style: { ...styleActive(), text: 'REPLAY\nACTIVE' } }],
	}

	const sections: CompanionPresetSection<OBSInstanceTypes>[] = [
		{
			id: 'replay',
			name: 'Replay Buffer',
			definitions: [
				{
					id: 'replay-control',
					name: 'Control',
					type: 'simple',
					presets: ['replayToggle', 'replayStart', 'replayStop', 'replaySave'],
				},
				{ id: 'replay-status', name: 'Status', type: 'simple', presets: ['replayStatus'] },
			],
		},
	]

	return { presets, sections }
}
