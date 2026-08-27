import { CompanionPresetDefinitions, CompanionPresetGroup, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import type { OBSInstanceTypes } from '../main.js'
import { baseStyle, generateSlug, styleActive, styleCaution } from './style.js'
import { validName } from '../utils.js'

/** Media presets: play/pause, time-remaining, and current media controls, grouped by source. */
export function getMediaPresets(self: OBSInstance): {
	presets: CompanionPresetDefinitions<OBSInstanceTypes>
	sections: CompanionPresetSection<OBSInstanceTypes>[]
} {
	const presets: CompanionPresetDefinitions<OBSInstanceTypes> = {}
	const groups: CompanionPresetGroup<OBSInstanceTypes>[] = [
		{
			id: 'media-current',
			type: 'simple',
			name: 'Current Media',
			presets: ['playPauseCurrentMedia', 'currentMediaElapsed', 'currentMediaRemaining'],
		},
	]
	const slugFor = generateSlug()

	presets['playPauseCurrentMedia'] = {
		type: 'simple',
		name: 'Play / Pause Current Media',
		style: baseStyle({ text: 'Play /\nPause\n$(obs:current_media_name)' }),
		steps: [
			{
				down: [{ actionId: 'media_control', options: { useCurrentMedia: true, source: '', action: 'toggle' } }],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['currentMediaElapsed'] = {
		type: 'simple',
		name: 'Current Media Time Elapsed',
		style: baseStyle({ text: 'Elapsed:\n$(obs:current_media_time_elapsed)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['currentMediaRemaining'] = {
		type: 'simple',
		name: 'Current Media Time Remaining',
		style: baseStyle({ text: 'Remaining:\n$(obs:current_media_time_remaining)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	for (const source of self.obsState.mediaSourceList) {
		const sourceId = String(source.id)
		const slug = slugFor(sourceId)
		const varName = validName(sourceId)
		const value = { value: sourceId, isExpression: false as const }
		const ids = {
			toggle: `media_${slug}_toggle`,
			status: `media_${slug}_status`,
			elapsed: `media_${slug}_elapsed`,
			scrubBack: `media_${slug}_scrubBack`,
			scrubForward: `media_${slug}_scrubForward`,
		}

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

		presets[ids.elapsed] = {
			type: 'simple',
			name: 'Media Time Elapsed',
			style: baseStyle({ text: `${source.label}\n$(obs:media_time_elapsed_${varName})` }),
			steps: [{ down: [], up: [] }],
			feedbacks: [],
		}

		presets[ids.scrubBack] = {
			type: 'simple',
			name: 'Scrub Back 10s',
			style: baseStyle({ text: `${source.label}\n-10 s` }),
			steps: [
				{
					down: [
						{
							actionId: 'media_time',
							options: { useCurrentMedia: false, source: value, mode: 'adjust', value: 0, amount: -10 },
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		}

		presets[ids.scrubForward] = {
			type: 'simple',
			name: 'Scrub Forward 10s',
			style: baseStyle({ text: `${source.label}\n+10 s` }),
			steps: [
				{
					down: [
						{
							actionId: 'media_time',
							options: { useCurrentMedia: false, source: value, mode: 'adjust', value: 0, amount: 10 },
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		}

		groups.push({
			id: `media-${slug}`,
			type: 'simple',
			name: source.label,
			keywords: [source.label, 'media', 'play', 'pause', 'scrub', 'remaining'],
			presets: [ids.toggle, ids.scrubBack, ids.scrubForward, ids.elapsed, ids.status],
		})
	}

	const sections: CompanionPresetSection<OBSInstanceTypes>[] = groups.length
		? [
				{
					id: 'media',
					name: 'Media',
					keywords: ['media', 'video', 'clip', 'playback', 'play', 'pause', 'vt', 'roll'],
					definitions: groups,
				},
			]
		: []

	return { presets, sections }
}
