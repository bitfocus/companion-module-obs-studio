import { CompanionPresetDefinitions } from '@companion-module/base'
import { Color } from '../utils.js'
import type { OBSInstance } from '../main.js'

export function getAudioPresets(self: OBSInstance): CompanionPresetDefinitions {
	const presets: CompanionPresetDefinitions = {}

	for (const audioSource of self.obsState.audioSourceList) {
		const sourceName = audioSource.label.replace(/[\W]/gi, '_')
		presets[`toggleSourceMute_${sourceName}`] = {
			type: 'button',
			category: 'Audio Sources',
			name: `Toggle ${audioSource.label}`,
			previewStyle: {
				text: `Toggle Mute ${audioSource.label}`,
			},
			style: {
				text: `Mute Toggle ${audioSource.label}`,
				size: 'auto',
				color: Color.White,
				bgcolor: Color.Black,
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'toggle_source_mute',
							options: {
								source: audioSource.id,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'audio_muted',
					options: {
						source: audioSource.id,
					},
					style: {
						color: Color.White,
						bgcolor: Color.Red,
						text: `${audioSource.label}\\nMuted`,
					},
				},
				{
					feedbackId: 'audio_muted',
					isInverted: true,
					options: {
						source: audioSource.id,
					},
					style: {
						color: Color.White,
						bgcolor: Color.Green,
						text: `${audioSource.label}\\nUnmuted`,
					},
				},
			],
		}
	}
	return presets
}
