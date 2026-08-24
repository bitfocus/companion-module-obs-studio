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
		previewStyle: baseStyle({ text: 'Toggle\nReplay Buffer' }),
		style: baseStyle({ text: 'Start\nReplay Buffer' }),
		steps: [{ down: [{ actionId: 'replay_buffer', options: { action: 'toggle' } }], up: [] }],
		feedbacks: [
			{ feedbackId: 'replayBufferActive', options: {}, style: { ...styleActive(), text: 'Stop\nReplay Buffer' } },
		],
	}

	presets['replayStart'] = {
		type: 'simple',
		name: 'Start Replay Buffer',
		style: baseStyle({ text: 'Start\nReplay Buffer' }),
		steps: [{ down: [{ actionId: 'replay_buffer', options: { action: 'start' } }], up: [] }],
		feedbacks: [],
	}

	presets['replayStop'] = {
		type: 'simple',
		name: 'Stop Replay Buffer',
		style: baseStyle({ text: 'Stop\nReplay Buffer' }),
		steps: [{ down: [{ actionId: 'replay_buffer', options: { action: 'stop' } }], up: [] }],
		feedbacks: [],
	}

	presets['replaySave'] = {
		type: 'simple',
		name: 'Save Replay Buffer',
		style: baseStyle({ text: 'Save\nReplay' }),
		steps: [{ down: [{ actionId: 'replay_buffer', options: { action: 'save' } }], up: [] }],
		feedbacks: [],
	}

	presets['replayStatus'] = {
		type: 'simple',
		name: 'Replay Buffer Status',
		style: baseStyle({ text: 'Replay:\nStopped' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [
			{ feedbackId: 'replayBufferActive', options: {}, style: { ...styleActive(), text: 'Replay:\nActive' } },
		],
	}

	presets['replayBufferPath'] = {
		type: 'simple',
		name: 'Last Saved Replay Path',
		style: baseStyle({ text: 'Replay File:\n$(obs:replay_buffer_path)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
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
				{ id: 'replay-status', name: 'Status', type: 'simple', presets: ['replayStatus', 'replayBufferPath'] },
			],
		},
	]

	return { presets, sections }
}
