import {
	ButtonGraphicsDecorationType,
	CompanionPresetDefinitions,
	CompanionPresetSection,
} from '@companion-module/base'
import type OBSInstance from '../main.js'
import type { OBSInstanceTypes } from '../main.js'
import { baseStyle, styleActive, styleWarn, Style } from './style.js'
import { CONGESTION_GOOD, CONGESTION_MEDIOCRE } from '../constants.js'

/** Streaming control + status presets (split out of the former monolithic outputs file). */
export function getStreamingPresets(_self: OBSInstance): {
	presets: CompanionPresetDefinitions<OBSInstanceTypes>
	sections: CompanionPresetSection<OBSInstanceTypes>[]
} {
	const presets: CompanionPresetDefinitions<OBSInstanceTypes> = {}

	presets['streaming'] = {
		type: 'simple',
		keywords: ['stream', 'live', 'go live', 'broadcast'],
		name: 'Toggle Streaming',
		previewStyle: baseStyle({ text: 'Toggle\nStreaming' }),
		style: baseStyle({ text: 'Start\nStreaming' }),
		steps: [{ down: [{ actionId: 'streaming', options: { action: 'toggle' } }], up: [] }],
		feedbacks: [{ feedbackId: 'streaming', options: {}, style: { ...styleActive(), text: 'Stop\nStreaming' } }],
	}

	presets['streamingStart'] = {
		type: 'simple',
		name: 'Start Streaming',
		style: baseStyle({ text: 'Start\nStreaming' }),
		steps: [{ down: [{ actionId: 'streaming', options: { action: 'start' } }], up: [] }],
		feedbacks: [],
	}

	presets['streamingStop'] = {
		type: 'simple',
		name: 'Stop Streaming',
		style: baseStyle({ text: 'Stop\nStreaming' }),
		steps: [{ down: [{ actionId: 'streaming', options: { action: 'stop' } }], up: [] }],
		feedbacks: [],
	}

	presets['streamingStatus'] = {
		type: 'simple',
		name: 'Streaming Status / Timecode',
		style: baseStyle({ text: 'Stream:\n$(obs:streaming)\n$(obs:stream_timecode)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [
			{ feedbackId: 'streaming', options: {}, style: styleActive() },
			{ feedbackId: 'streamReconnecting', options: {}, style: styleWarn() },
		],
	}

	// OBS's status-bar signal icon: four bars that drop out as congestion rises, coloured green /
	// yellow / red on the same thresholds OBS buckets its own excellent/good/mediocre/bad icons at.
	// Bars are lit by expression rather than by a gauge, so the staircase reads at a glance.
	const withinGood = `$(local:congestion) <= ${Math.round(CONGESTION_GOOD * 100)}`
	const withinMediocre = `$(local:congestion) <= ${Math.round(CONGESTION_MEDIOCRE * 100)}`
	const litColor = `(${withinGood}) ? ${Style.preview} : (${withinMediocre}) ? ${Style.caution} : ${Style.program}`
	// Bar 1 is lit whenever the stream is up; each further bar needs a better congestion bucket.
	const barLit = ['true', withinMediocre, withinGood, '$(local:congestion) <= 0']
	// Children are positioned within the group's own 0-100 space, so the bars fill the lower half
	// of the button and the label owns the upper half.
	const bars = barLit.map((lit, index) => {
		const height = 40 + index * 20
		return {
			type: 'box' as const,
			id: `bar${index + 1}`,
			name: `Bar ${index + 1}`,
			x: 17 + index * 18,
			y: 100 - height,
			width: 12,
			height,
			cornerRadius: 2,
			color: {
				value: `($(local:live) && (${lit})) ? (${litColor}) : ${Style.disabled}`,
				isExpression: true as const,
			},
		}
	})

	presets['streamingCongestion'] = {
		type: 'alternatives',
		variants: [
			{
				type: 'layered',
				keywords: ['health', 'dropped frames', 'network', 'signal', 'bars'],
				name: 'Stream Congestion',
				canvas: { decoration: ButtonGraphicsDecorationType.None },
				localVariables: [
					{
						variableType: 'feedback',
						variableName: 'congestion',
						feedbackId: 'streamCongestionLevel',
						options: {},
						headline: 'Stream congestion (0-100)',
					},
					{
						variableType: 'feedback',
						variableName: 'live',
						feedbackId: 'streaming',
						options: {},
						headline: 'Streaming',
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
						x: 0,
						y: 5,
						width: 100,
						height: 34,
						text: 'Stream Health',
						fontsize: 100,
						fontsizeAllowShrink: true,
						color: Style.idleFg,
						halign: 'center',
						valign: 'center',
					},
					{
						type: 'group',
						id: 'bars',
						name: 'Signal Bars',
						x: 0,
						y: 45,
						width: 100,
						height: 50,
						children: bars,
					},
				],
				steps: [{ down: [], up: [] }],
				feedbacks: [],
			},
			{
				type: 'simple',
				keywords: ['health', 'dropped frames', 'network'],
				name: 'Stream Congestion',
				style: baseStyle({ text: 'Stream:\nHealth' }),
				steps: [{ down: [], up: [] }],
				feedbacks: [
					{
						feedbackId: 'streamCongestion',
						options: {
							colorNoStream: Style.disabled,
							colorLow: Style.active,
							colorMedium: Style.warning,
							colorHigh: Style.alert,
						},
					},
				],
			},
		],
	}

	presets['streamingService'] = {
		type: 'simple',
		name: 'Stream Service Info',
		style: baseStyle({ text: 'Stream Dest:\n$(obs:stream_service)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['streamingBitrate'] = {
		type: 'simple',
		keywords: ['kbps', 'bandwidth', 'data rate'],
		name: 'Stream Bitrate',
		style: baseStyle({ text: 'Bitrate:\n$(obs:kbits_per_sec) kb/s' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['streamingTimecodeHH'] = {
		type: 'simple',
		name: 'Streaming Timecode HH',
		previewStyle: baseStyle({ text: 'Stream Time:\nHours' }),
		style: baseStyle({ text: '$(obs:stream_timecode_hh)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['streamingTimecodeMM'] = {
		type: 'simple',
		name: 'Streaming Timecode MM',
		previewStyle: baseStyle({ text: 'Stream Time:\nMinutes' }),
		style: baseStyle({ text: '$(obs:stream_timecode_mm)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['streamingTimecodeSS'] = {
		type: 'simple',
		name: 'Streaming Timecode SS',
		previewStyle: baseStyle({ text: 'Stream Time:\nSeconds' }),
		style: baseStyle({ text: '$(obs:stream_timecode_ss)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	const sections: CompanionPresetSection<OBSInstanceTypes>[] = [
		{
			id: 'streaming',
			name: 'Streaming',
			keywords: ['stream', 'live', 'broadcast', 'bitrate', 'congestion', 'rtmp'],
			definitions: [
				{
					id: 'streaming-control',
					name: 'Control',
					type: 'simple',
					presets: ['streaming', 'streamingStart', 'streamingStop'],
				},
				{
					id: 'streaming-status',
					name: 'Status',
					type: 'simple',
					presets: [
						'streamingStatus',
						'streamingCongestion',
						'streamingReconnecting',
						'streamingService',
						'streamingBitrate',
						'streamingTimecodeHH',
						'streamingTimecodeMM',
						'streamingTimecodeSS',
					],
				},
			],
		},
	]

	return { presets, sections }
}
