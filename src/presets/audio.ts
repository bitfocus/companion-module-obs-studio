import { CompanionPresetDefinitions, CompanionPresetGroup, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import type { OBSInstanceTypes } from '../main.js'
import { baseStyle, styleActive, styleMuted, Color } from './style.js'

/** Audio presets: per-source controls for volume, mute, and monitoring, grouped by source. */
export function getAudioPresets(self: OBSInstance): {
	presets: CompanionPresetDefinitions<OBSInstanceTypes>
	sections: CompanionPresetSection<OBSInstanceTypes>[]
} {
	const presets: CompanionPresetDefinitions<OBSInstanceTypes> = {}
	const groups: CompanionPresetGroup<OBSInstanceTypes>[] = []

	for (const source of self.obsState.audioSourceList) {
		const sourceId = String(source.id)
		const slug = sourceId.replace(/[^a-zA-Z0-9]+/g, '_')
		const value = { value: sourceId, isExpression: false as const }
		const ids = {
			mute: `audio_${slug}_mute`,
			volUp: `audio_${slug}_volUp`,
			volDown: `audio_${slug}_volDown`,
			monitor: `audio_${slug}_monitor`,
			status: `audio_${slug}_status`,
		}

		presets[ids.mute] = {
			type: 'simple',
			name: 'Toggle Mute',
			style: baseStyle({ text: source.label }),
			steps: [{ down: [{ actionId: 'mute', options: { source: value, mute: 'toggle' } }], up: [] }],
			feedbacks: [
				{
					feedbackId: 'audio_muted',
					options: { source: value },
					style: { ...styleMuted(), text: `${source.label}\nMuted` },
				},
				{
					feedbackId: 'audio_muted',
					isInverted: true,
					options: { source: value },
					style: { ...styleActive(), text: `${source.label}\nUnmuted` },
				},
			],
		}

		presets[ids.volUp] = {
			type: 'simple',
			name: 'Volume +3 dB',
			style: baseStyle({ text: `${source.label}\n+3 dB` }),
			steps: [
				{
					down: [
						{
							actionId: 'volume',
							options: { source: value, mode: 'adjust', unit: 'db', value: 0, duration: 0, amount: 3 },
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		}

		presets[ids.volDown] = {
			type: 'simple',
			name: 'Volume -3 dB',
			style: baseStyle({ text: `${source.label}\n-3 dB` }),
			steps: [
				{
					down: [
						{
							actionId: 'volume',
							options: { source: value, mode: 'adjust', unit: 'db', value: 0, duration: 0, amount: -3 },
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		}

		presets[ids.monitor] = {
			type: 'simple',
			name: 'Toggle Monitoring',
			style: baseStyle({ text: `${source.label}\nMonitor` }),
			steps: [{ down: [{ actionId: 'set_audio_monitor', options: { source: value, monitor: 'toggle' } }], up: [] }],
			feedbacks: [{ feedbackId: 'audio_monitor_type', options: { source: value }, style: styleActive() }],
		}

		presets[ids.status] = {
			type: 'simple',
			name: 'Audio Status',
			style: baseStyle({ text: source.label }),
			steps: [{ down: [], up: [] }],
			feedbacks: [
				{ feedbackId: 'audioPeaking', options: { source: value, threshold: -20 }, style: styleActive() },
				{ feedbackId: 'audio_muted', options: { source: value }, style: { bgcolor: Color.Red, color: Color.White } },
			],
		}

		groups.push({
			id: `audio-${slug}`,
			type: 'simple',
			name: source.label,
			presets: [ids.mute, ids.volUp, ids.volDown, ids.monitor, ids.status],
		})
	}

	const sections: CompanionPresetSection<OBSInstanceTypes>[] = [
		{
			id: 'audio',
			name: 'Audio',
			definitions: groups,
		},
	]

	return { presets, sections }
}
