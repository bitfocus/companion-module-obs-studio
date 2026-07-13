import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { ObsAudioMonitorType } from '../types.js'
import { baseStyle, styleActive, styleMuted, Color } from './style.js'

/** Audio presets: per-source controls for volume, mute, and monitoring. */
export function getAudioPresets(self: OBSInstance): {
	presets: CompanionPresetDefinitions
	sections: CompanionPresetSection[]
} {
	const presets: CompanionPresetDefinitions = {}

	presets['tpl_audioMute'] = {
		type: 'simple',
		name: 'Toggle Mute',
		localVariables: [{ variableType: 'simple', variableName: 'source', startupValue: '', headline: 'Audio source' }],
		style: baseStyle({ text: '$(local:source)' }),
		steps: [
			{
				down: [
					{ actionId: 'toggle_source_mute', options: { source: { value: '$(local:source)', isExpression: true } } },
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'audio_muted',
				options: { source: { value: '$(local:source)', isExpression: true } },
				style: { ...styleMuted(), text: '$(local:source)\nMuted' },
			},
			{
				feedbackId: 'audio_muted',
				isInverted: true,
				options: { source: { value: '$(local:source)', isExpression: true } },
				style: { ...styleActive(), text: '$(local:source)\nUnmuted' },
			},
		],
	}

	presets['tpl_audioVolUp'] = {
		type: 'simple',
		name: 'Volume +3 dB',
		localVariables: [{ variableType: 'simple', variableName: 'source', startupValue: '', headline: 'Audio source' }],
		style: baseStyle({ text: '$(local:source)\n+3 dB' }),
		steps: [
			{
				down: [
					{
						actionId: 'adjust_volume',
						options: { source: { value: '$(local:source)', isExpression: true }, volume: 3 },
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['tpl_audioVolDown'] = {
		type: 'simple',
		name: 'Volume -3 dB',
		localVariables: [{ variableType: 'simple', variableName: 'source', startupValue: '', headline: 'Audio source' }],
		style: baseStyle({ text: '$(local:source)\n-3 dB' }),
		steps: [
			{
				down: [
					{
						actionId: 'adjust_volume',
						options: { source: { value: '$(local:source)', isExpression: true }, volume: -3 },
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['tpl_audioMonitor'] = {
		type: 'simple',
		name: 'Monitor + Output',
		localVariables: [{ variableType: 'simple', variableName: 'source', startupValue: '', headline: 'Audio source' }],
		style: baseStyle({ text: '$(local:source)\nMonitor' }),
		steps: [
			{
				down: [
					{
						actionId: 'set_audio_monitor',
						options: {
							source: { value: '$(local:source)', isExpression: true },
							monitor: ObsAudioMonitorType.MonitorAndOutput,
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'audio_monitor_type',
				options: {
					source: { value: '$(local:source)', isExpression: true },
					monitor: ObsAudioMonitorType.MonitorAndOutput,
				},
				style: styleActive(),
			},
		],
	}

	presets['tpl_audioStatus'] = {
		type: 'simple',
		name: 'Audio Status',
		localVariables: [{ variableType: 'simple', variableName: 'source', startupValue: '', headline: 'Audio source' }],
		style: baseStyle({ text: '$(local:source)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [
			{
				feedbackId: 'audioPeaking',
				options: { source: { value: '$(local:source)', isExpression: true }, threshold: -20 },
				style: styleActive(),
			},
			{
				feedbackId: 'audio_muted',
				options: { source: { value: '$(local:source)', isExpression: true } },
				style: { bgcolor: Color.Red, color: Color.White },
			},
		],
	}

	const audioValues = self.obsState.audioSourceList.map((s) => ({ name: s.label, value: s.id }))

	const sections: CompanionPresetSection[] = [
		{
			id: 'audio',
			name: 'Audio',
			definitions: [
				{
					id: 'audio-mute',
					name: 'Toggle Mute',
					type: 'template',
					presetId: 'tpl_audioMute',
					templateVariableName: 'source',
					templateValues: audioValues,
				},
				{
					id: 'audio-volume-up',
					name: 'Volume Up',
					type: 'template',
					presetId: 'tpl_audioVolUp',
					templateVariableName: 'source',
					templateValues: audioValues,
				},
				{
					id: 'audio-volume-down',
					name: 'Volume Down',
					type: 'template',
					presetId: 'tpl_audioVolDown',
					templateVariableName: 'source',
					templateValues: audioValues,
				},
				{
					id: 'audio-monitor',
					name: 'Monitoring',
					type: 'template',
					presetId: 'tpl_audioMonitor',
					templateVariableName: 'source',
					templateValues: audioValues,
				},
				{
					id: 'audio-status',
					name: 'Status',
					type: 'template',
					presetId: 'tpl_audioStatus',
					templateVariableName: 'source',
					templateValues: audioValues,
				},
			],
		},
	]

	return { presets, sections }
}
