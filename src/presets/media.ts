import { CompanionPresetDefinitions } from '@companion-module/base'
import { Color } from '../utils.js'
import type { OBSInstance } from '../main.js'

export function getMediaPresets(self: OBSInstance): CompanionPresetDefinitions {
	const presets: CompanionPresetDefinitions = {}

	presets['playPauseCurrentMedia'] = {
		type: 'button',
		category: 'Media Sources',
		name: 'Play/Pause Current Media',
		style: {
			text: 'Play/\\nPause:\\n$(obs:current_media_name)',
			size: 'auto',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'play_pause_media',
						options: {
							useCurrentMedia: true,
							playPause: 'toggle',
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	for (const mediaSource of self.obsState.mediaSourceList) {
		const sourceName = mediaSource.label.replace(/[\W]/gi, '_')
		presets[`toggleMedia_${mediaSource.id}`] = {
			type: 'button',
			category: 'Media Sources',
			name: `Play Pause ${mediaSource.label}`,
			style: {
				text: `${mediaSource.label}\\n$(obs:media_status_${sourceName})`,
				size: 'auto',
				color: Color.White,
				bgcolor: Color.Black,
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'play_pause_media',
							options: {
								source: mediaSource.id,
								playPause: 'toggle',
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'media_playing',
					options: {
						source: mediaSource.id,
					},
					style: {
						bgcolor: Color.Green,
						color: Color.White,
					},
				},
			],
		}
	}
	return presets
}
