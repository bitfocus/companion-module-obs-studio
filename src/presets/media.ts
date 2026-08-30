import {
	ButtonGraphicsDecorationType,
	CompanionButtonStepActions,
	CompanionPresetDefinitions,
	CompanionPresetGroup,
	CompanionPresetSection,
} from '@companion-module/base'
import type OBSInstance from '../main.js'
import type { OBSInstanceTypes } from '../main.js'
import { baseStyle, generateSlug, Style, styleCaution, stylePreview } from './style.js'
import { pauseIcon, playIcon } from './icons.js'
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

	// Run-out warning on the progress bar: yellow under 20s left, red under 10s. The `> 0` guard keeps
	// a stopped or unloaded source (remaining 0) from sitting permanently red.
	const running = '$(local:remaining) > 0'
	const progressColor =
		`(${running} && $(local:remaining) <= 10) ? ${Style.program} : ` +
		`(${running} && $(local:remaining) <= 20) ? ${Style.caution} : ` +
		`${Style.active}`

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
			scrubRotary: `media_${slug}_scrubRotary`,
			restart: `media_${slug}_restart`,
			stop: `media_${slug}_stop`,
			previous: `media_${slug}_previous`,
			next: `media_${slug}_next`,
		}
		const status = `$(obs:media_status_${varName})`
		const playing = `${status} == 'Playing'`

		const toggleStep: CompanionButtonStepActions<OBSInstanceTypes> = {
			down: [{ actionId: 'media_control', options: { useCurrentMedia: false, source: value, action: 'toggle' } }],
			up: [],
		}

		// Alternatives: an icon of what the press will do — pause while playing, play otherwise — over a
		// green background while the clip runs. Switched by the status variable, so no extra feedback is
		// needed to tell "paused" from "stopped".
		presets[ids.toggle] = {
			type: 'alternatives',
			variants: [
				{
					type: 'layered',
					name: 'Play / Pause Media',
					canvas: { decoration: ButtonGraphicsDecorationType.None },
					elements: [
						{
							type: 'box',
							id: 'background',
							name: 'Background',
							x: 0,
							y: 0,
							width: 100,
							height: 100,
							color: { value: `${playing} ? ${Style.preview} : ${Style.idleBg}`, isExpression: true },
						},
						{
							type: 'text',
							id: 'label',
							name: 'Media Name',
							x: 4,
							y: 4,
							width: 92,
							height: 40,
							text: source.label,
							fontsize: 100,
							weight: 'bold',
							fontsizeAllowShrink: true,
							color: Style.idleFg,
							halign: 'center',
							valign: 'center',
						},
						{
							type: 'image',
							id: 'iconPause',
							name: 'Pause',
							x: 33,
							y: 48,
							width: 34,
							height: 34,
							base64Image: pauseIcon,
							fillMode: 'fit',
							enabled: { value: playing, isExpression: true },
						},
						{
							type: 'image',
							id: 'iconPlay',
							name: 'Play',
							x: 33,
							y: 48,
							width: 34,
							height: 34,
							base64Image: playIcon,
							fillMode: 'fit',
							enabled: { value: `!(${playing})`, isExpression: true },
						},
					],
					steps: [toggleStep],
					feedbacks: [],
				},
				{
					type: 'simple',
					name: 'Play / Pause Media',
					style: baseStyle({ text: `${source.label}\n${status}` }),
					steps: [toggleStep],
					feedbacks: [{ feedbackId: 'media_playing', options: { source: value }, style: stylePreview() }],
				},
			],
		}

		for (const transport of [
			{ id: ids.restart, action: 'restart' as const, label: 'Restart' },
			{ id: ids.stop, action: 'stop' as const, label: 'Stop' },
			{ id: ids.previous, action: 'previous' as const, label: 'Previous' },
			{ id: ids.next, action: 'next' as const, label: 'Next' },
		]) {
			presets[transport.id] = {
				type: 'simple',
				name: `${transport.label} Media`,
				style: baseStyle({ text: `${source.label}\n${transport.label}` }),
				steps: [
					{
						down: [
							{
								actionId: 'media_control',
								options: { useCurrentMedia: false, source: value, action: transport.action },
							},
						],
						up: [],
					},
				],
				feedbacks: [],
			}
		}

		// Alternatives: a progress gauge where the host can draw it, otherwise the flat timecode button.
		presets[ids.status] = {
			type: 'alternatives',
			variants: [
				{
					type: 'layered',
					name: 'Media Time Remaining',
					canvas: { decoration: ButtonGraphicsDecorationType.None },
					localVariables: [
						{
							variableType: 'feedback',
							variableName: 'progress',
							feedbackId: 'mediaProgress',
							options: { source: value },
							headline: 'Playback progress (%)',
						},
						{
							variableType: 'feedback',
							variableName: 'remaining',
							feedbackId: 'mediaTimeRemaining',
							options: { source: value },
							headline: 'Time remaining (seconds)',
						},
					],
					elements: [
						{
							type: 'box',
							id: 'background',
							name: 'Background',
							x: 0,
							y: 0,
							width: 100,
							height: 100,
							color: Style.idleBg,
						},
						{
							type: 'gauge',
							id: 'progress',
							name: 'Progress',
							x: 8,
							y: 70,
							width: 84,
							height: 16,
							orientation: 'horizontal',
							value: { value: '$(local:progress)', isExpression: true },
							min: 0,
							max: 100,
							fillEnabled: true,
							trackStyle: 'dimmed',
							trackAmount: 33,
							stops: [{ value: 0, color: { value: progressColor, isExpression: true }, gradient: false }],
							markerEnabled: true,
						},
						{
							type: 'text',
							id: 'timeElapsed',
							name: 'Time Elapsed',
							x: 8,
							y: 45,
							width: 40,
							height: 20,
							text: `$(obs:media_time_elapsed_${varName})`,
							fontsize: 100,
							weight: 'bold',
							fontsizeAllowShrink: true,
							color: Style.idleFg,
							halign: 'left',
							valign: 'center',
						},
						{
							type: 'text',
							id: 'timeRemaining',
							name: 'Time Remaining',
							x: 52,
							y: 45,
							width: 40,
							height: 20,
							text: `-$(obs:media_time_remaining_${varName})`,
							fontsize: 100,
							weight: 'bold',
							fontsizeAllowShrink: true,
							color: Style.idleFg,
							halign: 'right',
							valign: 'center',
						},
						{
							type: 'text',
							id: 'label',
							name: 'Media Name',
							x: 0,
							y: 0,
							width: 100,
							height: 45,
							text: `${source.label}`,
							fontsize: 50,
							weight: 'bold',
							fontsizeAllowShrink: true,
							color: Style.idleFg,
							halign: 'center',
							valign: 'center',
						},
					],
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
							styleOverrides: [
								{
									elementId: 'label',
									elementProperty: 'color',
									override: { isExpression: false, value: Style.caution },
								},
							],
						},
						{
							feedbackId: 'media_source_time_remaining',
							options: {
								source: value,
								rtThreshold: 10,
								onlyIfSourceIsOnProgram: false,
								onlyIfSourceIsPlaying: true,
								blinkingEnabled: false,
							},
							styleOverrides: [
								{
									elementId: 'label',
									elementProperty: 'color',
									override: { isExpression: false, value: Style.program },
								},
							],
						},
					],
				},
				{
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

		// Scrub rotary: 5 seconds per detent, with the ring showing how far through the clip we are.
		// Seeking lands on a keyframe, so a smaller step often resolves back to the same one when moving
		// forward, and the clip appears not to move.
		const scrubStep: CompanionButtonStepActions<OBSInstanceTypes> = {
			down: [],
			up: [],
			rotate_left: [
				{
					actionId: 'media_time',
					options: { useCurrentMedia: false, source: value, mode: 'adjust', value: 0, amount: -5 },
				},
			],
			rotate_right: [
				{
					actionId: 'media_time',
					options: { useCurrentMedia: false, source: value, mode: 'adjust', value: 0, amount: 5 },
				},
			],
		}

		presets[ids.scrubRotary] = {
			type: 'alternatives',
			variants: [
				{
					type: 'layered',
					name: 'Scrub Rotary',
					keywords: ['rotary', 'knob', 'encoder', 'scrub', 'jog'],
					canvas: { decoration: ButtonGraphicsDecorationType.None },
					localVariables: [
						{
							variableType: 'feedback',
							variableName: 'progress',
							feedbackId: 'mediaProgress',
							options: { source: value },
							headline: 'Playback progress (%)',
						},
					],
					elements: [
						{
							type: 'box',
							id: 'background',
							name: 'Background',
							x: 0,
							y: 0,
							width: 100,
							height: 100,
							color: Style.idleBg,
						},
						{
							type: 'gauge',
							id: 'progress',
							name: 'Progress',
							x: 6,
							y: 6,
							width: 88,
							height: 88,
							orientation: 'ring',
							startAngle: 135,
							endAngle: 45,
							ringWidth: 12,
							roundedEnds: true,
							value: { value: '$(local:progress)', isExpression: true },
							min: 0,
							max: 100,
							fillEnabled: true,
							trackStyle: 'dimmed',
							stops: [{ value: 0, color: Style.active, gradient: false }],
						},
						{
							type: 'text',
							id: 'label',
							name: 'Media Name',
							x: 22,
							y: 26,
							width: 56,
							height: 30,
							text: source.label,
							fontsize: 55,
							fontsizeAllowShrink: true,
							color: Style.idleFg,
							halign: 'center',
							valign: 'center',
						},
						{
							type: 'text',
							id: 'timeRemaining',
							name: 'Time Remaining',
							x: 22,
							y: 56,
							width: 56,
							height: 24,
							text: `-$(obs:media_time_remaining_${varName})`,
							fontsize: 70,
							fontsizeAllowShrink: true,
							color: Style.idleFg,
							halign: 'center',
							valign: 'center',
						},
					],
					steps: [scrubStep],
					feedbacks: [],
				},
				{
					type: 'simple',
					name: 'Scrub Rotary',
					keywords: ['rotary', 'knob', 'encoder', 'scrub', 'jog'],
					style: baseStyle({ text: `${source.label}\nScrub\n$(obs:media_time_remaining_${varName})` }),
					steps: [scrubStep],
					feedbacks: [],
				},
			],
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
			keywords: [source.label, 'media', 'play', 'pause', 'stop', 'scrub', 'jog', 'remaining'],
			presets: [
				ids.status,
				ids.toggle,
				ids.restart,
				ids.stop,
				ids.previous,
				ids.next,
				ids.scrubBack,
				ids.scrubForward,
				ids.scrubRotary,
				ids.elapsed,
			],
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
