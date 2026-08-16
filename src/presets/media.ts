import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import type { OBSInstanceTypes } from '../main.js'
import { baseStyle, styleActive, styleCaution } from './style.js'

/** Media presets: play/pause, time-remaining, and current media controls. */
export function getMediaPresets(self: OBSInstance): {
	presets: CompanionPresetDefinitions<OBSInstanceTypes>
	sections: CompanionPresetSection<OBSInstanceTypes>[]
} {
	const presets: CompanionPresetDefinitions<OBSInstanceTypes> = {}

	presets['playPauseCurrentMedia'] = {
		type: 'simple',
		name: 'Play/Pause Current Media',
		style: baseStyle({ text: 'Play/\nPause:\n$(obs:current_media_name)' }),
		steps: [
			{
				down: [{ actionId: 'media_control', options: { useCurrentMedia: true, source: '', action: 'toggle' } }],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['tmp_mediaToggle'] = {
		type: 'simple',
		name: 'Play / Pause Media',
		localVariables: [{ variableType: 'simple', variableName: 'source', startupValue: '', headline: 'Media source' }],
		style: baseStyle({ text: '$(local:source)' }),
		steps: [
			{
				down: [
					{
						actionId: 'media_control',
						options: {
							useCurrentMedia: false,
							source: { value: '$(local:source)', isExpression: true },
							action: 'toggle',
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'media_playing',
				options: { source: { value: '$(local:source)', isExpression: true } },
				style: styleActive(),
			},
		],
	}

	presets['tmp_mediaStatus'] = {
		type: 'simple',
		name: 'Media Time Remaining',
		localVariables: [{ variableType: 'simple', variableName: 'source', startupValue: '', headline: 'Media source' }],
		style: baseStyle({ text: '$(local:source)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [
			{
				feedbackId: 'media_source_time_remaining',
				options: {
					source: { value: '$(local:source)', isExpression: true },
					rtThreshold: 20,
					onlyIfSourceIsOnProgram: false,
					onlyIfSourceIsPlaying: true,
					blinkingEnabled: false,
				},
				style: styleCaution(),
			},
		],
	}

	const mediaValues = self.obsState.mediaSourceList.map((s) => ({ name: s.label, value: s.id }))

	const sections: CompanionPresetSection<OBSInstanceTypes>[] = [
		{
			id: 'media',
			name: 'Media',
			definitions: [
				{ id: 'media-current', name: 'Current Media', type: 'simple', presets: ['playPauseCurrentMedia'] },
				{
					id: 'media-control',
					name: 'Play / Pause',
					type: 'template',
					presetId: 'tmp_mediaToggle',
					templateVariableName: 'source',
					templateValues: mediaValues,
				},
				{
					id: 'media-status',
					name: 'Status',
					type: 'template',
					presetId: 'tmp_mediaStatus',
					templateVariableName: 'source',
					templateValues: mediaValues,
				},
			],
		},
	]

	return { presets, sections }
}
