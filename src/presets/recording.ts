import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import type { OBSInstanceTypes } from '../main.js'
import { baseStyle, styleProgram, styleWarn } from './style.js'

/** Recording control + status presets (split out of the former monolithic outputs file). */
export function getRecordingPresets(_self: OBSInstance): {
	presets: CompanionPresetDefinitions<OBSInstanceTypes>
	sections: CompanionPresetSection<OBSInstanceTypes>[]
} {
	const presets: CompanionPresetDefinitions<OBSInstanceTypes> = {}

	presets['recording'] = {
		type: 'simple',
		name: 'Toggle Recording',
		previewStyle: baseStyle({ text: 'Toggle\nRecording' }),
		style: baseStyle({ text: 'Start\nRecording' }),
		steps: [{ down: [{ actionId: 'recording', options: { action: 'toggle', chapterName: '' } }], up: [] }],
		feedbacks: [
			{ feedbackId: 'recording', options: {}, style: { ...styleProgram(), text: 'Stop\nRecording' } },
			{ feedbackId: 'recordingPaused', options: {}, style: styleWarn() },
		],
	}

	presets['recordStart'] = {
		type: 'simple',
		name: 'Start Recording',
		style: baseStyle({ text: 'Start\nRecording' }),
		steps: [{ down: [{ actionId: 'recording', options: { action: 'start', chapterName: '' } }], up: [] }],
		feedbacks: [],
	}

	presets['recordStop'] = {
		type: 'simple',
		name: 'Stop Recording',
		style: baseStyle({ text: 'Stop\nRecording' }),
		steps: [{ down: [{ actionId: 'recording', options: { action: 'stop', chapterName: '' } }], up: [] }],
		feedbacks: [],
	}

	presets['recordPause'] = {
		type: 'simple',
		name: 'Pause Recording',
		style: baseStyle({ text: 'Pause\nRecording' }),
		steps: [{ down: [{ actionId: 'recording', options: { action: 'pause', chapterName: '' } }], up: [] }],
		feedbacks: [{ feedbackId: 'recordingPaused', options: {}, style: styleWarn() }],
	}

	presets['recordResume'] = {
		type: 'simple',
		name: 'Resume Recording',
		style: baseStyle({ text: 'Resume\nRecording' }),
		steps: [{ down: [{ actionId: 'recording', options: { action: 'resume', chapterName: '' } }], up: [] }],
		feedbacks: [],
	}

	presets['recordSplit'] = {
		type: 'simple',
		name: 'Split File',
		style: baseStyle({ text: 'Split\nFile' }),
		steps: [{ down: [{ actionId: 'recording', options: { action: 'split', chapterName: '' } }], up: [] }],
		feedbacks: [],
	}

	presets['recordChapter'] = {
		type: 'simple',
		name: 'Add Chapter Marker',
		style: baseStyle({ text: 'Add\nChapter' }),
		steps: [{ down: [{ actionId: 'recording', options: { action: 'chapter', chapterName: '' } }], up: [] }],
		feedbacks: [],
	}

	presets['recordingStatusTimecode'] = {
		type: 'simple',
		name: 'Recording Status / Timecode',
		style: baseStyle({ text: 'Recording:\n$(obs:recording)\n$(obs:recording_timecode)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [
			{ feedbackId: 'recording', options: {}, style: styleProgram() },
			{ feedbackId: 'recordingPaused', options: {}, style: styleWarn() },
		],
	}

	presets['recordingTimecodeHH'] = {
		type: 'simple',
		name: 'Recording Timecode HH',
		previewStyle: baseStyle({ text: 'Rec Time:\nHours' }),
		style: baseStyle({ text: '$(obs:recording_timecode_hh)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['recordingTimecodeMM'] = {
		type: 'simple',
		name: 'Recording Timecode MM',
		previewStyle: baseStyle({ text: 'Rec Time:\nMinutes' }),
		style: baseStyle({ text: '$(obs:recording_timecode_mm)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['recordingTimecodeSS'] = {
		type: 'simple',
		name: 'Recording Timecode SS',
		previewStyle: baseStyle({ text: 'Rec Time:\nSeconds' }),
		style: baseStyle({ text: '$(obs:recording_timecode_ss)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['recordingFilePath'] = {
		type: 'simple',
		name: 'Recording File Path',
		style: baseStyle({ text: 'Rec Path:\n$(obs:recording_path)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['recordingFileName'] = {
		type: 'simple',
		name: 'Recording File Name',
		style: baseStyle({ text: 'Rec File:\n$(obs:recording_file_name)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	const sections: CompanionPresetSection<OBSInstanceTypes>[] = [
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
