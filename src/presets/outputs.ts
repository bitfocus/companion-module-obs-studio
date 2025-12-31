import { CompanionPresetDefinitions } from '@companion-module/base'
import { Color } from '../utils.js'
import type { OBSInstance } from '../main.js'

export function getOutputPresets(self: OBSInstance): CompanionPresetDefinitions {
	const presets: CompanionPresetDefinitions = {}
	presets['streamingControlHeader'] = {
		type: 'text',
		category: 'Streaming',
		name: 'Streaming Controls',
		text: '',
	}
	presets['streaming'] = {
		type: 'button',
		category: 'Streaming',
		name: 'OBS Toggle Streaming',
		previewStyle: {
			text: 'OBS TOGGLE STREAM',
			size: 'auto',
		},
		style: {
			text: 'OBS START STREAM',
			size: 'auto',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'StartStopStreaming',
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'streaming',
				options: {},
				style: {
					bgcolor: Color.Green,
					color: Color.White,
					text: 'OBS STOP STREAM',
				},
			},
		],
	}
	presets['streamingStart'] = {
		type: 'button',
		category: 'Streaming',
		name: 'OBS Start Stream',
		style: {
			text: 'OBS START STREAM',
			size: 'auto',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'start_streaming',
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}
	presets['streamingStop'] = {
		type: 'button',
		category: 'Streaming',
		name: 'OBS Stop Stream',
		style: {
			text: 'OBS STOP STREAM',
			size: 'auto',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'stop_streaming',
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}
	presets['streamingInfoHeader'] = {
		type: 'text',
		category: 'Streaming',
		name: 'Streaming Info',
		text: '',
	}
	presets['streamingStatus'] = {
		type: 'button',
		category: 'Streaming',
		name: 'Streaming Status / Timecode',
		style: {
			text: 'STREAM STATUS\\n$(obs:streaming)\\n$(obs:stream_timecode)',
			size: 14,
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'streaming',
				options: {},
				style: {
					bgcolor: Color.Green,
					color: Color.White,
				},
			},
		],
	}
	presets['streamingService'] = {
		type: 'button',
		category: 'Streaming',
		name: 'Streaming Service Info',
		style: {
			text: 'STREAM DEST\\n$(obs:stream_service)',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [],
				up: [],
			},
		],
		feedbacks: [],
	}
	presets['streamingTimecodeHH'] = {
		type: 'button',
		category: 'Streaming',
		name: 'Streaming Timecode HH',
		previewStyle: {
			text: 'Stream Time:\\nHours',
			size: '14',
		},
		style: {
			text: '$(obs:stream_timecode_hh)',
			size: 'auto',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [],
				up: [],
			},
		],
		feedbacks: [],
	}
	presets['streamingTimecodeMM'] = {
		type: 'button',
		category: 'Streaming',
		name: 'Streaming Timecode MM',
		previewStyle: {
			text: 'Stream Time:\\nMinutes',
			size: '14',
		},
		style: {
			text: '$(obs:stream_timecode_mm)',
			size: 'auto',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['streamingTimecodeSS'] = {
		type: 'button',
		category: 'Streaming',
		name: 'Streaming Timecode SS',
		previewStyle: {
			text: 'Stream Time:\\nSeconds',
			size: '14',
		},
		style: {
			text: '$(obs:stream_timecode_ss)',
			size: 'auto',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['recordingControlHeader'] = {
		type: 'text',
		category: 'Recording',
		name: 'Recording Controls',
		text: '',
	}
	presets['recording'] = {
		type: 'button',
		category: 'Recording',
		name: 'OBS Recording',
		previewStyle: {
			text: 'OBS TOGGLE RECORD',
			size: 'auto',
		},
		style: {
			text: 'OBS START RECORD',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'toggle_recording',
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'recording',
				options: {},
				style: {
					text: 'OBS STOP RECORD',
					bgcolor: Color.Red,
					color: Color.White,
				},
			},
			{
				feedbackId: 'recordingPaused',
				options: {},
				style: {
					bgcolor: Color.Orange,
					color: Color.White,
				},
			},
		],
	}
	presets['recordStart'] = {
		type: 'button',
		category: 'Recording',
		name: 'OBS Start Record',
		style: {
			text: 'OBS START RECORD',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'start_recording',
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}
	presets['recordStop'] = {
		type: 'button',
		category: 'Recording',
		name: 'OBS Stop Record',
		style: {
			text: 'OBS STOP RECORD',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'stop_recording',
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}
	presets['recordPause'] = {
		type: 'button',
		category: 'Recording',
		name: 'OBS Pause Record',
		style: {
			text: 'OBS PAUSE RECORD',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'pause_recording',
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}
	presets['recordResume'] = {
		type: 'button',
		category: 'Recording',
		name: 'OBS Resume Record',
		style: {
			text: 'OBS RESUME RECORD',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'resume_recording',
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}
	presets['recordSplit'] = {
		type: 'button',
		category: 'Recording',
		name: 'OBS Split Record',
		style: {
			text: 'OBS SPLIT RECORD',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'SplitRecordFile',
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}
	presets['recordChapter'] = {
		type: 'button',
		category: 'Recording',
		name: 'OBS Record Chapter',
		style: {
			text: 'OBS CREATE CHAPTER',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'CreateRecordChapter',
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}
	presets['recordingInfoHeader'] = {
		type: 'text',
		category: 'Recording',
		name: 'Recording Info',
		text: '',
	}

	presets['recordingStatusTimecode'] = {
		type: 'button',
		category: 'Recording',
		name: 'Recording Status / Timecode',
		style: {
			text: 'REC STATUS\\n$(obs:recording)\\n$(obs:recording_timecode)',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		previewStyle: {
			text: 'REC STATUS\n$(obs:recording)\\n00:00:00',
			size: '14',
		},
		steps: [
			{
				down: [],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'recording',
				options: {},
				style: {
					bgcolor: Color.Red,
					color: Color.White,
				},
			},
			{
				feedbackId: 'recordingPaused',
				options: {},
				style: {
					bgcolor: Color.Orange,
					color: Color.White,
				},
			},
		],
	}

	presets['recordingTimecodeHH'] = {
		type: 'button',
		category: 'Recording',
		name: 'Recording Timecode HH',
		style: {
			text: 'REC TIME\n$(obs:recording_timecode_hh)',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		previewStyle: {
			text: 'REC STATUS\n$(obs:recording)\n00:00:00',
			size: '14',
		},
		steps: [
			{
				down: [],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['recordingTimecodeHH'] = {
		type: 'button',
		category: 'Recording',
		name: 'Recording Timecode HH',
		style: {
			text: '$(obs:recording_timecode_hh)',
			size: 'auto',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		previewStyle: {
			text: 'REC Time: Hours',
			size: '14',
		},
		steps: [
			{
				down: [],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['recordingTimecodeMM'] = {
		type: 'button',
		category: 'Recording',
		name: 'Recording Timecode MM',
		style: {
			text: '$(obs:recording_timecode_mm)',
			size: 'auto',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		previewStyle: {
			text: 'REC Time: Mins',
			size: '14',
		},
		steps: [
			{
				down: [],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['recordingTimecodeSS'] = {
		type: 'button',
		category: 'Recording',
		name: 'Recording Timecode SS',
		style: {
			text: '$(obs:recording_timecode_ss)',
			size: 'auto',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		previewStyle: {
			text: 'REC Time: Seconds',
			size: '14',
		},
		steps: [
			{
				down: [],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['recordingFilePath'] = {
		type: 'button',
		category: 'Recording',
		name: 'Recording File Path',
		style: {
			text: 'REC PATH:\\n$(obs:recording_path)',
			size: 'auto',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [],
				up: [],
			},
		],
		feedbacks: [],
	}
	presets['recordingFileName'] = {
		type: 'button',
		category: 'Recording',
		name: 'Recording File Name',
		style: {
			text: 'REC FILE:\\n$(obs:recording_file_name)',
			size: 'auto',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [],
				up: [],
			},
		],
		feedbacks: [],
	}

	for (const output of self.obsState.outputList) {
		presets[`output${output.id}Header`] = {
			type: 'text',
			category: 'Outputs',
			name: output.label,
			text: '',
		}
		presets[`statusOutput_${output.id}`] = {
			type: 'button',
			category: 'Outputs',
			name: `Status ${output.label}`,
			style: {
				text: `STATUS\\n${output.label}`,
				size: 'auto',
				color: Color.White,
				bgcolor: Color.Black,
				show_topbar: false,
			},
			steps: [
				{
					down: [],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'output_active',
					options: {
						output: output.id,
					},
					style: {
						bgcolor: Color.Green,
						color: Color.White,
						text: `STATUS\\n${output.label}\\nActive`,
					},
				},
				{
					feedbackId: 'output_active',
					isInverted: true,
					options: {
						output: output.id,
					},
					style: {
						bgcolor: Color.Black,
						color: Color.White,
						text: `STATUS\\n${output.label}\\nInactive`,
					},
				},
			],
		}
		presets[`toggleOutput_${output.id}`] = {
			type: 'button',
			category: 'Outputs',
			name: `Toggle ${output.label}`,
			previewStyle: {
				text: `TOGGLE\\n${output.label}`,
				size: 'auto',
				color: Color.White,
				bgcolor: Color.Black,
				show_topbar: false,
			},
			style: {
				text: `Toggle Output ${output.label}`,
				size: 'auto',
				color: Color.White,
				bgcolor: Color.Black,
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'start_stop_output',
							options: {
								output: output.id,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'output_active',
					options: {
						output: output.id,
					},
					style: {
						bgcolor: Color.Green,
						color: Color.White,
						text: `STOP\\n${output.label}`,
					},
				},
				{
					feedbackId: 'output_active',
					isInverted: true,
					options: {
						output: output.id,
					},
					style: {
						bgcolor: Color.Black,
						color: Color.White,
						text: `START\\n${output.label}`,
					},
				},
			],
		}
		presets[`startOutput_${output.id}`] = {
			type: 'button',
			category: 'Outputs',
			name: `Start ${output.label}`,
			style: {
				text: `START\\n${output.label}`,
				size: 'auto',
				color: Color.White,
				bgcolor: Color.Black,
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'start_output',
							options: {
								output: output.id,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		}
		presets[`stopOutput_${output.id}`] = {
			type: 'button',
			category: 'Outputs',
			name: `Stop ${output.label}`,
			style: {
				text: `STOP\\n${output.label}`,
				size: 'auto',
				color: Color.White,
				bgcolor: Color.Black,
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'stop_output',
							options: {
								output: output.id,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		}
	}
	return presets
}
