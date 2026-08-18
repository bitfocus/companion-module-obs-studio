import { CompanionPresetDefinitions, CompanionPresetGroup, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import type { OBSInstanceTypes } from '../main.js'
import { baseStyle, styleActive, styleCaution } from './style.js'
import { validName } from '../utils.js'

/** Media presets: play/pause, time-remaining, and current media controls, grouped by source. */
export function getMediaPresets(self: OBSInstance): {
	presets: CompanionPresetDefinitions<OBSInstanceTypes>
	sections: CompanionPresetSection<OBSInstanceTypes>[]
} {
	const presets: CompanionPresetDefinitions<OBSInstanceTypes> = {}
	const groups: CompanionPresetGroup<OBSInstanceTypes>[] = [
		{ id: 'media-current', type: 'simple', name: 'Current Media', presets: ['playPauseCurrentMedia'] },
	]

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

	for (const source of self.obsState.mediaSourceList) {
		const sourceId = String(source.id)
		const slug = sourceId.replace(/[^a-zA-Z0-9]+/g, '_')
		const varName = validName(sourceId)
		const value = { value: sourceId, isExpression: false as const }
		const ids = { toggle: `media_${slug}_toggle`, status: `media_${slug}_status` }

		presets[ids.toggle] = {
			type: 'simple',
			name: 'Play / Pause Media',
			style: baseStyle({ text: `${source.label}\n$(obs:media_status_${varName})` }),
			steps: [
				{
					down: [{ actionId: 'media_control', options: { useCurrentMedia: false, source: value, action: 'toggle' } }],
					up: [],
				},
			],
			feedbacks: [{ feedbackId: 'media_playing', options: { source: value }, style: styleActive() }],
		}

		presets[ids.status] = {
			type: 'simple',
			name: 'Media Time Remaining',
			style: baseStyle({ text: `${source.label}\n$(obs:media_time_remaining_${varName})` }),
			steps: [{ down: [], up: [] }],
			feedbacks: [
				{
					feedbackId: 'media_source_time_remaining',
					options: {
						source: value,
						rtThreshold: 20,
						onlyIfSourceIsOnProgram: false,
						onlyIfSourceIsPlaying: true,
						blinkingEnabled: false,
					},
					style: styleCaution(),
				},
			],
		}

		groups.push({ id: `media-${slug}`, type: 'simple', name: source.label, presets: [ids.toggle, ids.status] })
	}

	const sections: CompanionPresetSection<OBSInstanceTypes>[] = [
		{
			id: 'media',
			name: 'Media',
			definitions: groups,
		},
	]

	return { presets, sections }
}
