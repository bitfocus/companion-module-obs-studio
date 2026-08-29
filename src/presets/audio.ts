import {
	ButtonGraphicsDecorationType,
	CompanionPresetDefinitions,
	CompanionPresetGroup,
	CompanionPresetSection,
} from '@companion-module/base'
import type OBSInstance from '../main.js'
import type { OBSInstanceTypes } from '../main.js'
import { validName } from '../utils.js'
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
			track1: `audio_${slug}_track1`,
			unity: `audio_${slug}_unity`,
		}

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
							height: 90,
							text: source.label,
							fontsize: 25,
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
							type: 'text',
							id: 'label',
							name: 'Label',
							x: 4,
							y: 8,
							width: 92,
							height: 40,
							text: `${source.label}\n$(local:volume) dB`,
							fontsize: 100,
							fontsizeAllowShrink: true,
							color: Style.idleFg,
							halign: 'center',
							valign: 'center',
						},
						{
							type: 'gauge',
							id: 'fader',
							name: 'Fader',
							x: 8,
							y: 62,
							width: 84,
							height: 20,
							orientation: 'horizontal',
							value: { value: '$(local:volume)', isExpression: true },
							min: -60,
							max: 0,
							fillEnabled: true,
							trackStyle: 'dimmed',
							stops: [{ value: -60, color: Style.active, gradient: false }],
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

		presets[ids.track1] = {
			type: 'simple',
			name: 'Toggle Track 1',
			style: baseStyle({ text: `${source.label}\nTrack 1` }),
			steps: [
				{
					down: [{ actionId: 'set_audio_tracks', options: { source: value, tracks: ['1'], value: 'toggle' } }],
					up: [],
				},
			],
			feedbacks: [{ feedbackId: 'audio_track', options: { source: value, track: '1' }, style: styleActive() }],
		}

		presets[ids.unity] = {
			type: 'simple',
			name: 'Set Volume to 0 dB',
			style: baseStyle({ text: `${source.label}\n0 dB` }),
			steps: [
				{
					down: [
						{
							actionId: 'volume',
							options: { source: value, mode: 'set', unit: 'db', value: 0, duration: 0, amount: 0 },
						},
					],
					up: [],
				},
			],
			feedbacks: [{ feedbackId: 'volume', options: { source: value, volume: 0 }, style: styleActive() }],
		}

		groups.push({
			id: `audio-${slug}`,
			type: 'simple',
			name: source.label,
			keywords: [source.label, 'audio', 'mute', 'volume', 'monitor', 'track'],
			presets: [ids.mute, ids.volUp, ids.volDown, ids.unity, ids.monitor, ids.track1, ids.meter, ids.level],
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
