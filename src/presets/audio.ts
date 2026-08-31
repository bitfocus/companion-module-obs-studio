import {
	ButtonGraphicsDecorationType,
	CompanionButtonStepActions,
	CompanionPresetDefinitions,
	CompanionPresetGroup,
	CompanionPresetSection,
} from '@companion-module/base'
import type OBSInstance from '../main.js'
import type { OBSInstanceTypes } from '../main.js'
import { validName } from '../utils.js'
import { AUDIO_TRACK_CHOICES } from '../actions/options.js'
import { headphonesIcon, headphonesOffIcon, speakerIcon, speakerMutedIcon } from './icons.js'
import {
	baseStyle,
	generateSlug,
	Style,
	styleActive,
	styleAlert,
	stylePreview,
	styleProgram,
	styleWarn,
} from './style.js'

/** Audio presets: per-source controls for volume, mute, and monitoring, grouped by source. */
export function getAudioPresets(self: OBSInstance): {
	presets: CompanionPresetDefinitions<OBSInstanceTypes>
	sections: CompanionPresetSection<OBSInstanceTypes>[]
} {
	const presets: CompanionPresetDefinitions<OBSInstanceTypes> = {}
	const groups: CompanionPresetGroup<OBSInstanceTypes>[] = []
	const slugFor = generateSlug()

	for (const source of self.obsState.audioSourceList) {
		const sourceId = String(source.id)
		const slug = slugFor(sourceId)
		const value = { value: sourceId, isExpression: false as const }
		const ids = {
			mute: `audio_${slug}_mute`,
			volUp: `audio_${slug}_volUp`,
			volDown: `audio_${slug}_volDown`,
			monitor: `audio_${slug}_monitor`,
			meter: `audio_${slug}_meter`,
			level: `audio_${slug}_level`,
			rotary: `audio_${slug}_rotary`,
			offset: `audio_${slug}_offset`,
			offsetDown: `audio_${slug}_offsetDown`,
			offsetUp: `audio_${slug}_offsetUp`,
			balance: `audio_${slug}_balance`,
			tracks: `audio_${slug}_tracks`,
		}
		const trackIds = AUDIO_TRACK_CHOICES.map((track) => ({
			id: `audio_${slug}_track${track.id}`,
			track: String(track.id),
			label: track.label,
		}))

		presets[ids.mute] = {
			type: 'simple',
			name: 'Toggle Mute',
			style: baseStyle({ text: `${source.label}\nMute` }),
			steps: [{ down: [{ actionId: 'mute', options: { source: value, mute: 'toggle' } }], up: [] }],
			feedbacks: [
				{
					feedbackId: 'audio_muted',
					options: { source: value },
					style: { ...styleAlert(), text: `${source.label}\nMuted` },
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
			feedbacks: [{ feedbackId: 'audio_monitor_type', options: { source: value }, style: stylePreview() }],
		}

		// Alternatives: the gauge layered variant where the host supports it, otherwise a flat button
		// coloured by stacked peaking thresholds, mirroring the OBS mixer meter.
		presets[ids.meter] = {
			type: 'alternatives',
			variants: [
				{
					type: 'layered',
					name: 'Audio Meter',
					canvas: { decoration: ButtonGraphicsDecorationType.None },
					localVariables: [
						{
							variableType: 'feedback',
							variableName: 'peak',
							feedbackId: 'audioPeakLevel',
							options: { source: value },
							headline: 'Peak level (dB)',
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
							id: 'meter',
							name: 'Meter',
							x: 4,
							y: 4,
							width: 15,
							height: 90,
							orientation: 'vertical',
							value: { value: '$(local:peak)', isExpression: true },
							min: -60,
							max: 0,
							fillEnabled: true,
							multiColour: true,
							trackStyle: 'dimmed',
							stops: [
								{ value: -60, color: Style.preview, gradient: false },
								{ value: -20, color: Style.warning, gradient: false },
								{ value: -9, color: Style.program, gradient: false },
							],
						},
						{
							type: 'text',
							id: 'label',
							name: 'Label',
							x: 22,
							y: 4,
							width: 75,
							height: 52,
							text: source.label,
							fontsize: 100,
							fontsizeAllowShrink: true,
							weight: 'bold',
							color: Style.idleFg,
							halign: 'center',
							valign: 'center',
						},
						{
							type: 'group',
							id: 'status',
							name: 'Mixer Status',
							x: 22,
							y: 58,
							width: 75,
							height: 36,
							// Only one icon of each pair is drawn; the feedbacks below swap which.
							children: [
								{
									type: 'image',
									id: 'iconUnmuted',
									name: 'Unmuted',
									x: 4,
									y: 0,
									width: 40,
									height: 100,
									base64Image: speakerIcon,
									fillMode: 'fit',
								},
								{
									type: 'image',
									id: 'iconMuted',
									name: 'Muted',
									x: 4,
									y: 0,
									width: 40,
									height: 100,
									base64Image: speakerMutedIcon,
									fillMode: 'fit',
									enabled: false,
								},
								{
									type: 'box',
									id: 'monitorBackground',
									name: 'Monitoring Background',
									x: 56,
									y: 0,
									width: 40,
									height: 100,
									cornerRadius: 4,
									color: Style.preview,
									enabled: false,
								},
								{
									type: 'image',
									id: 'iconMonitorOff',
									name: 'Monitoring Off',
									x: 56,
									y: 0,
									width: 40,
									height: 100,
									base64Image: headphonesOffIcon,
									fillMode: 'fit',
								},
								{
									type: 'image',
									id: 'iconMonitorOn',
									name: 'Monitoring On',
									x: 56,
									y: 0,
									width: 40,
									height: 100,
									base64Image: headphonesIcon,
									fillMode: 'fit',
									enabled: false,
								},
							],
						},
					],
					steps: [{ down: [], up: [] }],
					feedbacks: [
						{
							feedbackId: 'audio_muted',
							options: { source: value },
							styleOverrides: [
								{
									elementId: 'iconUnmuted',
									elementProperty: 'enabled',
									override: { isExpression: false, value: false },
								},
								{ elementId: 'iconMuted', elementProperty: 'enabled', override: { isExpression: false, value: true } },
							],
						},
						{
							feedbackId: 'audio_monitor_type',
							options: { source: value },
							styleOverrides: [
								{
									elementId: 'iconMonitorOff',
									elementProperty: 'enabled',
									override: { isExpression: false, value: false },
								},
								{
									elementId: 'iconMonitorOn',
									elementProperty: 'enabled',
									override: { isExpression: false, value: true },
								},
								{
									elementId: 'monitorBackground',
									elementProperty: 'enabled',
									override: { isExpression: false, value: true },
								},
							],
						},
					],
				},
				{
					type: 'simple',
					name: 'Audio Meter',
					style: baseStyle({ text: source.label }),
					steps: [{ down: [], up: [] }],
					// Stacked thresholds, loudest last so it wins when several are true.
					feedbacks: [
						{ feedbackId: 'audioPeaking', options: { source: value, threshold: -60 }, style: stylePreview() },
						{ feedbackId: 'audioPeaking', options: { source: value, threshold: -20 }, style: styleWarn() },
						{ feedbackId: 'audioPeaking', options: { source: value, threshold: -9 }, style: styleProgram() },
					],
				},
			],
		}

		// Volume readout: a fader-style gauge where the host can draw it, otherwise the variable as text.
		presets[ids.level] = {
			type: 'alternatives',
			variants: [
				{
					type: 'layered',
					name: 'Volume Level',
					canvas: { decoration: ButtonGraphicsDecorationType.None },
					localVariables: [
						{
							variableType: 'feedback',
							variableName: 'volume',
							feedbackId: 'sourceVolume',
							options: { source: value },
							headline: 'Volume (dB)',
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
							id: 'fader',
							name: 'Fader',
							x: 4,
							y: 4,
							width: 15,
							height: 90,
							orientation: 'vertical',
							value: { value: '$(local:volume)', isExpression: true },
							min: -60,
							max: 0,
							fillEnabled: true,
							trackStyle: 'dimmed',
							trackAmount: 33,
							markerEnabled: true,
							stops: [{ value: -60, color: Style.active, gradient: false }],
						},
						{
							type: 'text',
							id: 'label',
							name: 'Label',
							x: 22,
							y: 4,
							width: 75,
							height: 52,
							text: source.label,
							fontsize: 100,
							weight: 'bold',
							fontsizeAllowShrink: true,
							color: Style.idleFg,
							halign: 'center',
							valign: 'center',
						},
						{
							type: 'text',
							id: 'readout',
							name: 'Volume Readout',
							x: 22,
							y: 58,
							width: 75,
							height: 36,
							text: '$(local:volume) dB',
							fontsize: 50,
							fontsizeAllowShrink: true,
							color: Style.idleFg,
							halign: 'center',
							valign: 'center',
						},
					],
					steps: [{ down: [], up: [] }],
					feedbacks: [],
				},
				{
					type: 'simple',
					name: 'Volume Level',
					style: baseStyle({ text: `${source.label}\n$(obs:volume_${validName(sourceId)}) dB` }),
					steps: [{ down: [], up: [] }],
					feedbacks: [],
				},
			],
		}

		const rotaryStep: CompanionButtonStepActions<OBSInstanceTypes> = {
			down: [],
			up: [],
			rotate_left: [
				{
					actionId: 'volume',
					options: { source: value, mode: 'adjust', unit: 'db', value: 0, duration: 0, amount: -1 },
				},
			],
			rotate_right: [
				{
					actionId: 'volume',
					options: { source: value, mode: 'adjust', unit: 'db', value: 0, duration: 0, amount: 1 },
				},
			],
		}

		// Rotary: 1 dB per detent, with the ring showing where the fader currently sits.
		presets[ids.rotary] = {
			type: 'alternatives',
			variants: [
				{
					type: 'layered',
					name: 'Volume Rotary',
					keywords: ['rotary', 'knob', 'encoder', 'fader'],
					canvas: { decoration: ButtonGraphicsDecorationType.None },
					localVariables: [
						{
							variableType: 'feedback',
							variableName: 'volume',
							feedbackId: 'sourceVolume',
							options: { source: value },
							headline: 'Volume (dB)',
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
							id: 'fader',
							name: 'Fader',
							x: 6,
							y: 6,
							width: 88,
							height: 88,
							orientation: 'ring',
							startAngle: 135,
							endAngle: 45,
							ringWidth: 12,
							roundedEnds: true,
							value: { value: '$(local:volume)', isExpression: true },
							min: -60,
							max: 0,
							fillEnabled: true,
							trackStyle: 'dimmed',
							stops: [{ value: -60, color: Style.active, gradient: false }],
						},
						{
							type: 'text',
							id: 'label',
							name: 'Label',
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
							id: 'readout',
							name: 'Volume Readout',
							x: 22,
							y: 56,
							width: 56,
							height: 24,
							text: '$(local:volume) dB',
							fontsize: 70,
							fontsizeAllowShrink: true,
							color: Style.idleFg,
							halign: 'center',
							valign: 'center',
						},
					],
					steps: [rotaryStep],
					feedbacks: [],
				},
				{
					type: 'simple',
					name: 'Volume Rotary',
					keywords: ['rotary', 'knob', 'encoder', 'fader'],
					style: baseStyle({ text: `${source.label}\n$(obs:volume_${validName(sourceId)}) dB` }),
					steps: [rotaryStep],
					feedbacks: [],
				},
			],
		}

		// Sync offset: 1 ms per detent, which is the resolution people nudge lip-sync at.
		const offsetStep: CompanionButtonStepActions<OBSInstanceTypes> = {
			down: [],
			up: [],
			rotate_left: [{ actionId: 'audio_offset', options: { source: value, mode: 'adjust', value: 0, amount: -1 } }],
			rotate_right: [{ actionId: 'audio_offset', options: { source: value, mode: 'adjust', value: 0, amount: 1 } }],
		}

		presets[ids.offset] = {
			type: 'simple',
			name: 'Sync Offset Rotary',
			keywords: ['rotary', 'knob', 'encoder', 'sync', 'delay', 'lip sync'],
			style: baseStyle({ text: `${source.label}\nOffset:\n$(obs:sync_offset_${validName(sourceId)}) ms` }),
			steps: [offsetStep],
			feedbacks: [],
		}

		for (const step of [
			{ id: ids.offsetDown, amount: -1, label: '-1 ms' },
			{ id: ids.offsetUp, amount: 1, label: '+1 ms' },
		]) {
			presets[step.id] = {
				type: 'simple',
				name: `Sync Offset ${step.label}`,
				keywords: ['sync', 'delay', 'lip sync'],
				style: baseStyle({ text: `${source.label}\nOffset\n${step.label}` }),
				steps: [
					{
						down: [
							{ actionId: 'audio_offset', options: { source: value, mode: 'adjust', value: 0, amount: step.amount } },
						],
						up: [],
					},
				],
				feedbacks: [],
			}
		}

		// Balance: a left/right slider, stepped 5% per detent.
		const balanceStep: CompanionButtonStepActions<OBSInstanceTypes> = {
			down: [],
			up: [],
			rotate_left: [
				{ actionId: 'audio_balance', options: { source: value, mode: 'adjust', value: 0.5, amount: -0.1 } },
			],
			rotate_right: [
				{ actionId: 'audio_balance', options: { source: value, mode: 'adjust', value: 0.5, amount: 0.1 } },
			],
		}

		presets[ids.balance] = {
			type: 'alternatives',
			variants: [
				{
					type: 'layered',
					name: 'Balance',
					keywords: ['rotary', 'knob', 'encoder', 'pan', 'left', 'right'],
					canvas: { decoration: ButtonGraphicsDecorationType.None },
					localVariables: [
						{
							variableType: 'feedback',
							variableName: 'balance',
							feedbackId: 'sourceBalance',
							options: { source: value },
							headline: 'Balance (%)',
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
							type: 'text',
							id: 'label',
							name: 'Label',
							x: 4,
							y: 6,
							width: 92,
							height: 40,
							text: `${source.label}\nBalance`,
							fontsize: 45,
							fontsizeAllowShrink: true,
							color: Style.idleFg,
							halign: 'center',
							valign: 'center',
						},
						{
							type: 'text',
							id: 'labelLeft',
							name: 'Left',
							x: 2,
							y: 58,
							width: 14,
							height: 26,
							text: 'L',
							fontsize: 80,
							color: Style.idleFg,
							halign: 'center',
							valign: 'center',
						},
						{
							type: 'text',
							id: 'labelRight',
							name: 'Right',
							x: 84,
							y: 58,
							width: 14,
							height: 26,
							text: 'R',
							fontsize: 80,
							color: Style.idleFg,
							halign: 'center',
							valign: 'center',
						},
						{
							type: 'gauge',
							id: 'balance',
							name: 'Balance',
							x: 18,
							y: 62,
							width: 64,
							height: 18,
							orientation: 'horizontal',
							value: { value: '$(local:balance)', isExpression: true },
							min: 0,
							max: 100,
							fillEnabled: true,
							trackStyle: 'dimmed',
							stops: [{ value: 0, color: Style.active, gradient: false }],
							markerEnabled: true,
							markerColor: Style.idleFg,
							markerWidth: 18,
						},
					],
					steps: [balanceStep],
					feedbacks: [],
				},
				{
					type: 'simple',
					name: 'Balance',
					keywords: ['rotary', 'knob', 'encoder', 'pan', 'left', 'right'],
					style: baseStyle({ text: `${source.label}\nBalance:\n$(obs:balance_${validName(sourceId)})` }),
					steps: [balanceStep],
					feedbacks: [],
				},
			],
		}

		// One button for all six mixer tracks: a square per track, filled while that track is enabled.
		presets[ids.tracks] = {
			type: 'alternatives',
			variants: [
				{
					type: 'layered',
					name: 'Track Status',
					keywords: ['tracks', 'mixer', 'status'],
					canvas: { decoration: ButtonGraphicsDecorationType.None },
					localVariables: trackIds.map((track) => ({
						variableType: 'feedback' as const,
						variableName: `track${track.track}`,
						feedbackId: 'audio_track' as const,
						options: { source: value, track: track.track },
						headline: `${track.label} enabled`,
					})),
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
							type: 'text',
							id: 'label',
							name: 'Label',
							x: 4,
							y: 4,
							width: 92,
							height: 30,
							text: source.label,
							fontsize: 100,
							fontsizeAllowShrink: true,
							color: Style.idleFg,
							halign: 'center',
							valign: 'center',
						},
						{
							type: 'group',
							id: 'tracks',
							name: 'Tracks',
							// Spans the whole button, so child bounds stay in button percentages and a square
							// stays square. A group narrower than it is tall would stretch them.
							x: 0,
							y: 0,
							width: 100,
							height: 100,
							children: trackIds.flatMap((track, index) => {
								const x = 4 + index * 16
								return [
									{
										type: 'box' as const,
										id: `track${track.track}Square`,
										name: `${track.label} Square`,
										x,
										y: 56,
										width: 12,
										height: 12,
										cornerRadius: 2,
										color: {
											value: `$(local:track${track.track}) ? ${Style.active} : ${Style.disabled}`,
											isExpression: true as const,
										},
									},
									{
										type: 'text' as const,
										id: `track${track.track}Number`,
										name: `${track.label} Number`,
										x,
										y: 72,
										width: 12,
										height: 24,
										text: track.track,
										fontsize: 100,
										fontsizeAllowShrink: true,
										color: Style.idleFg,
										halign: 'center' as const,
										valign: 'center' as const,
									},
								]
							}),
						},
					],
					steps: [{ down: [], up: [] }],
					feedbacks: [],
				},
				{
					type: 'simple',
					name: 'Track Status',
					keywords: ['tracks', 'mixer', 'status'],
					style: baseStyle({ text: `${source.label}\nTracks:\n$(obs:tracks_${validName(sourceId)})` }),
					steps: [{ down: [], up: [] }],
					feedbacks: [],
				},
			],
		}

		for (const track of trackIds) {
			presets[track.id] = {
				type: 'simple',
				name: `Toggle ${track.label}`,
				style: baseStyle({ text: `${source.label}\n${track.label}` }),
				steps: [
					{
						down: [
							{ actionId: 'set_audio_tracks', options: { source: value, tracks: [track.track], value: 'toggle' } },
						],
						up: [],
					},
				],
				feedbacks: [
					{ feedbackId: 'audio_track', options: { source: value, track: track.track }, style: styleActive() },
				],
			}
		}

		groups.push({
			id: `audio-${slug}`,
			type: 'simple',
			name: source.label,
			keywords: [source.label, 'audio', 'mute', 'volume', 'monitor', 'track', 'balance', 'sync offset'],
			presets: [
				ids.meter,
				ids.mute,
				ids.monitor,
				ids.level,
				ids.rotary,
				ids.volDown,
				ids.volUp,
				ids.balance,
				ids.offset,
				ids.offsetDown,
				ids.offsetUp,
				ids.tracks,
				...trackIds.map((track) => track.id),
			],
		})
	}

	const sections: CompanionPresetSection<OBSInstanceTypes>[] = groups.length
		? [
				{
					id: 'audio',
					name: 'Audio',
					keywords: ['audio', 'sound', 'volume', 'mute', 'gain', 'fader', 'mixer', 'monitor'],
					definitions: groups,
				},
			]
		: []

	return { presets, sections }
}
