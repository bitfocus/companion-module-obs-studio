import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { baseStyle, styleProgram, styleWarn } from './style.js'

/** Recording control + status presets (split out of the former monolithic outputs file). */
export function getRecordingPresets(_self: OBSInstance): {
	presets: CompanionPresetDefinitions
	sections: CompanionPresetSection[]
} {
	const presets: CompanionPresetDefinitions = {}

	presets['recording'] = {
		type: 'simple',
		name: 'Toggle Recording',
		previewStyle: baseStyle({ text: 'TOGGLE\nRECORD' }),
		style: baseStyle({ text: 'START\nRECORD' }),
		steps: [{ down: [{ actionId: 'toggle_recording', options: {} }], up: [] }],
		feedbacks: [
			{ feedbackId: 'recording', options: {}, style: { ...styleProgram(), text: 'STOP\nRECORD' } },
			{ feedbackId: 'recordingPaused', options: {}, style: styleWarn() },
		],
	}

	presets['recordStart'] = {
		type: 'simple',
		name: 'Start Recording',
		style: baseStyle({ text: 'START\nRECORD' }),
		steps: [{ down: [{ actionId: 'start_recording', options: {} }], up: [] }],
		feedbacks: [],
	}

	presets['recordStop'] = {
		type: 'simple',
		name: 'Stop Recording',
		style: baseStyle({ text: 'STOP\nRECORD' }),
		steps: [{ down: [{ actionId: 'stop_recording', options: {} }], up: [] }],
		feedbacks: [],
	}

	presets['recordPause'] = {
		type: 'simple',
		name: 'Pause Recording',
		style: baseStyle({ text: 'PAUSE\nRECORD' }),
		steps: [{ down: [{ actionId: 'pause_recording', options: {} }], up: [] }],
		feedbacks: [{ feedbackId: 'recordingPaused', options: {}, style: styleWarn() }],
	}

	presets['recordResume'] = {
		type: 'simple',
		name: 'Resume Recording',
		style: baseStyle({ text: 'RESUME\nRECORD' }),
		steps: [{ down: [{ actionId: 'resume_recording', options: {} }], up: [] }],
		feedbacks: [],
	}

	presets['recordSplit'] = {
		type: 'simple',
		name: 'Split Recording File',
		style: baseStyle({ text: 'SPLIT\nRECORD' }),
		steps: [{ down: [{ actionId: 'SplitRecordFile', options: {} }], up: [] }],
		feedbacks: [],
	}

	presets['recordChapter'] = {
		type: 'simple',
		name: 'Create Recording Chapter',
		style: baseStyle({ text: 'CREATE\nCHAPTER' }),
		steps: [{ down: [{ actionId: 'CreateRecordChapter', options: {} }], up: [] }],
		feedbacks: [],
	}

	presets['recordingStatusTimecode'] = {
		type: 'simple',
		name: 'Recording Status / Timecode',
		style: baseStyle({ text: 'REC STATUS\n$(obs:recording)\n$(obs:recording_timecode)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [
			{ feedbackId: 'recording', options: {}, style: styleProgram() },
			{ feedbackId: 'recordingPaused', options: {}, style: styleWarn() },
		],
	}

	presets['recordingTimecodeHH'] = {
		type: 'simple',
		name: 'Recording Timecode HH',
		previewStyle: baseStyle({ text: 'REC Time:\nHours' }),
		style: baseStyle({ text: '$(obs:recording_timecode_hh)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['recordingTimecodeMM'] = {
		type: 'simple',
		name: 'Recording Timecode MM',
		previewStyle: baseStyle({ text: 'REC Time:\nMins' }),
		style: baseStyle({ text: '$(obs:recording_timecode_mm)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['recordingTimecodeSS'] = {
		type: 'simple',
		name: 'Recording Timecode SS',
		previewStyle: baseStyle({ text: 'REC Time:\nSeconds' }),
		style: baseStyle({ text: '$(obs:recording_timecode_ss)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['recordingFilePath'] = {
		type: 'simple',
		name: 'Recording File Path',
		style: baseStyle({ text: 'REC PATH:\n$(obs:recording_path)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['recordingFileName'] = {
		type: 'simple',
		name: 'Recording File Name',
		style: baseStyle({ text: 'REC FILE:\n$(obs:recording_file_name)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	const sections: CompanionPresetSection[] = [
		{
			id: 'recording',
			name: 'Recording',
			definitions: [
				{
					id: 'recording-control',
					name: 'Control',
					type: 'simple',
					presets: [
						'recording',
						'recordStart',
						'recordStop',
						'recordPause',
						'recordResume',
						'recordSplit',
						'recordChapter',
					],
				},
				{
					id: 'recording-status',
					name: 'Status',
					type: 'simple',
					presets: [
						'recordingStatusTimecode',
						'recordingTimecodeHH',
						'recordingTimecodeMM',
						'recordingTimecodeSS',
						'recordingFilePath',
						'recordingFileName',
					],
				},
			],
		},
	]

	return { presets, sections }
}
