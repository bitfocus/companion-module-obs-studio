import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import type { OBSInstanceTypes } from '../main.js'
import { baseStyle, styleActive, styleWarn, Style } from './style.js'

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

	presets['streamingCongestion'] = {
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
	}

	presets['streamingReconnecting'] = {
		type: 'simple',
		name: 'Stream Reconnecting',
		style: baseStyle({ text: 'Stream:\nOK' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [
			{ feedbackId: 'streamReconnecting', options: {}, style: { ...styleWarn(), text: 'Stream:\nReconnecting' } },
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
