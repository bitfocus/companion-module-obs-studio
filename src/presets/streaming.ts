import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { baseStyle, styleActive, styleWarn, Style } from './style.js'

/** Streaming control + status presets (split out of the former monolithic outputs file). */
export function getStreamingPresets(_self: OBSInstance): {
	presets: CompanionPresetDefinitions
	sections: CompanionPresetSection[]
} {
	const presets: CompanionPresetDefinitions = {}

	presets['streaming'] = {
		type: 'simple',
		name: 'Toggle Streaming',
		previewStyle: baseStyle({ text: 'TOGGLE\nSTREAM' }),
		style: baseStyle({ text: 'START\nSTREAM' }),
		steps: [{ down: [{ actionId: 'StartStopStreaming', options: {} }], up: [] }],
		feedbacks: [{ feedbackId: 'streaming', options: {}, style: { ...styleActive(), text: 'STOP\nSTREAM' } }],
	}

	presets['streamingStart'] = {
		type: 'simple',
		name: 'Start Stream',
		style: baseStyle({ text: 'START\nSTREAM' }),
		steps: [{ down: [{ actionId: 'start_streaming', options: {} }], up: [] }],
		feedbacks: [],
	}

	presets['streamingStop'] = {
		type: 'simple',
		name: 'Stop Stream',
		style: baseStyle({ text: 'STOP\nSTREAM' }),
		steps: [{ down: [{ actionId: 'stop_streaming', options: {} }], up: [] }],
		feedbacks: [],
	}

	presets['streamingStatus'] = {
		type: 'simple',
		name: 'Streaming Status / Timecode',
		style: baseStyle({ text: 'STREAM\n$(obs:streaming)\n$(obs:stream_timecode)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [
			{ feedbackId: 'streaming', options: {}, style: styleActive() },
			{ feedbackId: 'streamReconnecting', options: {}, style: styleWarn() },
		],
	}

	presets['streamingCongestion'] = {
		type: 'simple',
		name: 'Stream Congestion',
		style: baseStyle({ text: 'STREAM\nHEALTH' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [
			{
				feedbackId: 'streamCongestion',
				options: {
					colorNoStream: Style.idleBg,
					colorLow: Style.active,
					colorMedium: Style.warning,
					colorHigh: Style.alert,
				},
			},
		],
	}

	presets['streamingReconnecting'] = {
		type: 'simple',
		name: 'Stream Reconnecting',
		style: baseStyle({ text: 'STREAM\nOK' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [{ feedbackId: 'streamReconnecting', options: {}, style: { ...styleWarn(), text: 'RE-\nCONNECTING' } }],
	}

	presets['streamingService'] = {
		type: 'simple',
		name: 'Streaming Service Info',
		style: baseStyle({ text: 'STREAM DEST\n$(obs:stream_service)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['streamingBitrate'] = {
		type: 'simple',
		name: 'Stream Bitrate',
		style: baseStyle({ text: 'STREAM\n$(obs:kbits_per_sec)\nkb/s' }),
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

	const sections: CompanionPresetSection[] = [
		{
			id: 'streaming',
			name: 'Streaming',
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
