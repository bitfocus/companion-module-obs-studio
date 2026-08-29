import { CompanionPresetDefinitions, CompanionPresetGroup, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import type { OBSInstanceTypes } from '../main.js'
import { baseStyle, generateSlug, styleActive, styleAlert, stylePreview } from './style.js'

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
			status: `audio_${slug}_status`,
			meter: `audio_${slug}_meter`,
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

		presets[ids.meter] = {
			type: 'simple',
			name: 'Audio Meter',
			style: baseStyle({ text: source.label }),
			steps: [{ down: [], up: [] }],
			// Advanced feedback: it drives bgcolor itself, mirroring the OBS mixer meter.
			feedbacks: [{ feedbackId: 'audioMeter', options: { source: value, threshold: -60 } }],
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
			presets: [ids.mute, ids.volUp, ids.volDown, ids.unity, ids.monitor, ids.track1, ids.status, ids.meter],
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
