import { CompanionPresetDefinitions } from '@companion-module/base'
import { Color } from './utils.js'
import type { OBSInstance } from './main.js'

export function getPresets(this: OBSInstance): CompanionPresetDefinitions {
	const presets: CompanionPresetDefinitions = {}

	for (const scene of this.obsState.sceneChoices) {
		presets[`toProgram_${scene.id}`] = {
			type: 'button',
			category: 'Scene to Program',
			name: scene.label,
			style: {
				text: scene.label,
				size: 'auto',
				color: Color.White,
				bgcolor: Color.Black,
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'set_scene',
							options: {
								scene: scene.id,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'sceneProgram',
					options: {
						scene: scene.id,
					},
					style: {
						bgcolor: Color.Red,
						color: Color.White,
					},
				},
			],
		}

		presets[`toPreview_${scene.id}`] = {
			type: 'button',
			category: 'Scene to Preview',
			name: scene.label,
			style: {
				text: scene.label,
				size: 'auto',
				color: Color.White,
				bgcolor: Color.Black,
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'preview_scene',
							options: {
								scene: scene.id,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'scenePreview',
					options: {
						scene: scene.id,
					},
					style: {
						bgcolor: Color.Green,
						color: Color.White,
					},
				},
			],
		}
	}

	presets['transitionAutoHeader'] = {
		type: 'text',
		category: 'Transitions',
		name: 'Current Transition Control / Info',
		text: '',
	}
	presets['transitionAuto'] = {
		type: 'button',
		category: 'Transitions',
		name: 'Send previewed scene to program',
		style: {
			text: 'AUTO',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'do_transition',
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'transition_active',
				options: {},
				style: {
					bgcolor: Color.Green,
					color: Color.White,
				},
			},
		],
	}
	presets['transitionCurrentInfo'] = {
		type: 'button',
		category: 'Transitions',
		name: 'Current Transition Info',
		style: {
			text: 'Current Transition $(obs:current_transition)\\n$(obs:transition_duration)ms',
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
	presets['transitionDurationSetHeader'] = {
		type: 'text',
		category: 'Transitions',
		name: 'Set Transition Duration',
		text: '',
	}

	for (let time = 500; time < 5100; time += 500) {
		presets[`transitionDurationSet${time}`] = {
			type: 'button',
			category: 'Transitions',
			name: `Transition Set ${time}ms`,
			style: {
				text: `${time}ms`,
				size: '14',
				color: Color.White,
				bgcolor: Color.Black,
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'set_transition_duration',
							options: {
								duration: time,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'transition_duration',
					options: {
						duration: time,
					},
					style: {
						bgcolor: Color.Green,
						color: Color.White,
					},
				},
			],
		}
	}

	presets['transitionDurationHeader'] = {
		type: 'text',
		category: 'Transitions',
		name: 'Adjust Transition Duration',
		text: '',
	}
	presets['transitionDecreaseDuration'] = {
		type: 'button',
		category: 'Transitions',
		name: 'Decrease transition time',
		style: {
			text: 'Adjust Duration\\n-50ms',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'adjust_transition_duration',
						options: {
							amount: -50,
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['transitionDuration'] = {
		type: 'button',
		category: 'Transitions',
		name: 'Current Duration',
		style: {
			text: 'Current Duration $(obs:transition_duration)ms',
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
	presets['transitionIncreaseDuration'] = {
		type: 'button',
		category: 'Transitions',
		name: 'Increase transition time',
		style: {
			text: 'Adjust Duration\\n+50ms',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'adjust_transition_duration',
						options: {
							amount: 50,
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}
	presets['transitionTypeHeader'] = {
		type: 'text',
		category: 'Transitions',
		name: 'Set Transition Type',
		text: '',
	}
	for (const transition of this.obsState.transitionList) {
		presets[`setTransition_${transition.id}`] = {
			type: 'button',
			category: 'Transitions',
			name: transition.label,
			style: {
				text: transition.label,
				size: 14,
				color: Color.White,
				bgcolor: Color.Black,
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'set_transition_type',
							options: {
								transitions: transition.id,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'current_transition',
					options: {
						transition: transition.id,
					},
					style: {
						bgcolor: Color.Green,
						color: Color.White,
					},
				},
			],
		}
	}
	presets['transitionTypeAdjustHeader'] = {
		type: 'text',
		category: 'Transitions',
		name: 'Adjust Transition Type',
		text: '',
	}
	presets['transitionPrevious'] = {
		type: 'button',
		category: 'Transitions',
		name: 'Previous Transition',
		style: {
			text: 'Previous Transition',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'adjustTransitionType',
						options: {
							adjust: 'previous',
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}
	presets['transitionAdjustCurrent'] = {
		type: 'button',
		category: 'Transitions',
		name: 'Current Transition',
		style: {
			text: 'Current Transition $(obs:current_transition)',
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
	presets['transitionNext'] = {
		type: 'button',
		category: 'Transitions',
		name: 'Next Transition',
		style: {
			text: 'Next Transition',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'adjustTransitionType',
						options: {
							adjust: 'next',
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['quickTransitionsHeader'] = {
		type: 'text',
		category: 'Transitions',
		name: 'Quick Transitions',
		text: 'Execute a specific transition, and then revert back to the previous transition',
	}
	for (const transition of this.obsState.transitionList) {
		presets[`quickTransition_${transition.id}`] = {
			type: 'button',
			category: 'Transitions',
			name: transition.label,
			style: {
				text: transition.label,
				size: 14,
				color: Color.White,
				bgcolor: Color.Black,
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'quick_transition',
							options: {
								transition: transition.id,
								customDuration: false,
								transition_time: 500,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'transition_active',
					options: {},
					style: {
						bgcolor: Color.Green,
						color: Color.White,
					},
				},
			],
		}
	}

	// Preset for Start Streaming button with colors indicating streaming status
	presets['streaming'] = {
		type: 'button',
		category: 'Streaming',
		name: 'OBS Streaming',
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

	presets['streamingTimecode'] = {
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
				},
			},
		],
	}

	presets['streamingService'] = {
		type: 'button',
		category: 'Streaming',
		name: 'Streaming Service Info',
		style: {
			text: 'STREAM DEST\\n$(obs:stream_service)\\n$(obs:streaming)',
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
				},
			},
		],
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
				options: {
					bg: Color.Red,
					fg: Color.White,
					bg_paused: Color.Yellow,
					fg_paused: Color.White,
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
			text: 'REC STATUS\n$(obs:recording)\n00:00:00',
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
				options: {
					bg: Color.Red,
					fg: Color.White,
					bg_paused: Color.Yellow,
					fg_paused: Color.White,
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
		feedbacks: [
			{
				feedbackId: 'recording',
				options: {
					bg: Color.Red,
					fg: Color.White,
					bg_paused: Color.Yellow,
					fg_paused: Color.White,
				},
			},
		],
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

	for (const output of this.obsState.outputList) {
		presets[`output${output.id}Header`] = {
			type: 'text',
			category: 'Outputs',
			name: output.label,
			text: '',
		}
		presets[`toggleOutput_${output.id}`] = {
			type: 'button',
			category: 'Outputs',
			name: `Toggle ${output.label}`,
			style: {
				text: `OBS ${output.label}`,
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
					},
				},
			],
		}
	}

	const processedSources = new Set<string>()

	for (const scene of this.obsState.sceneChoices) {
		const sceneUuid = scene.id as string
		const sceneItems = this.obsState.state.sceneItems.get(sceneUuid) ?? []

		if (sceneItems.length > 0) {
			presets[`sceneSourcesHeader_${sceneUuid}`] = {
				type: 'text',
				category: 'Sources',
				name: scene.label,
				text: '',
			}

			for (const item of sceneItems) {
				const sourcesToProcess = []
				if (item.isGroup) {
					const groupItems = this.obsState.state.groups.get(item.sourceUuid) ?? []
					sourcesToProcess.push(...groupItems)
				} else {
					sourcesToProcess.push(item)
				}

				for (const sourceItem of sourcesToProcess) {
					processedSources.add(sourceItem.sourceUuid)
					presets[`sourceStatus_${sceneUuid}_${sourceItem.sourceUuid}`] = {
						type: 'button',
						category: 'Sources',
						name: `${sourceItem.sourceName} Status (${scene.label})`,
						style: {
							text: sourceItem.sourceName,
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
								feedbackId: 'scene_item_previewed',
								options: {
									source: sourceItem.sourceUuid,
								},
								style: {
									bgcolor: Color.Green,
									color: Color.White,
								},
							},
							{
								feedbackId: 'scene_item_active',
								options: {
									scene: 'anyScene',
									source: sourceItem.sourceUuid,
								},
								style: {
									bgcolor: Color.Red,
									color: Color.White,
								},
							},
						],
					}
				}
			}
		}
	}

	const otherSources = this.obsState.sourceChoices.filter((s) => !processedSources.has(s.id as string))
	if (otherSources.length > 0) {
		presets[`otherSourcesHeader`] = {
			type: 'text',
			category: 'Sources',
			name: 'Other Sources',
			text: '',
		}

		for (const source of otherSources) {
			presets[`sourceStatus_other_${source.id}`] = {
				type: 'button',
				category: 'Sources',
				name: `${source.label} Status`,
				style: {
					text: source.label,
					size: 'auto',
					color: Color.White,
					bgcolor: Color.Black,
				},
				steps: [
					{
						down: [],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'scene_item_previewed',
						options: {
							source: source.id,
						},
						style: {
							bgcolor: Color.Green,
							color: Color.White,
						},
					},
					{
						feedbackId: 'scene_item_active',
						options: {
							scene: 'anyScene',
							source: source.id,
						},
						style: {
							bgcolor: Color.Red,
							color: Color.White,
						},
					},
				],
			}
		}
	}

	presets['statsHeader'] = {
		type: 'text',
		category: 'General',
		name: 'Stats',
		text: '',
	}
	presets['cpuRamUsage'] = {
		type: 'button',
		category: 'General',
		name: 'CPU/RAM Usage',
		style: {
			text: 'CPU:\\n$(obs:cpu_usage)\\nRAM:\\n$(obs:memory_usage)',
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
	presets['cpuUsage'] = {
		type: 'button',
		category: 'General',
		name: 'CPU Usage',
		style: {
			text: 'CPU:\\n$(obs:cpu_usage)',
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
	presets['ramUsage'] = {
		type: 'button',
		category: 'General',
		name: 'RAM Usage',
		style: {
			text: 'RAM:\n$(obs:memory_usage)',
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

	presets['renderTotalFrames'] = {
		type: 'button',
		category: 'General',
		name: 'Render Total Frames',
		style: {
			text: 'Render Total Frames:\\n$(obs:render_total_frames)',
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
	presets['renderMissedFrames'] = {
		type: 'button',
		category: 'General',
		name: 'Render Missed Frames',
		style: {
			text: 'Render Missed Frames:\\n$(obs:render_missed_frames)',
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
	presets['outputTotalFrames'] = {
		type: 'button',
		category: 'General',
		name: 'Output Total Frames',
		style: {
			text: 'Output Total Frames:\\n$(obs:output_total_frames)',
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
	presets['outputSkippedFrames'] = {
		type: 'button',
		category: 'General',
		name: 'Output Skipped Frames',
		style: {
			text: 'Output Skipped Frames:\n$(obs:output_skipped_frames)',
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
	presets['averageFrameTime'] = {
		type: 'button',
		category: 'General',
		name: 'Average Frame Time',
		style: {
			text: 'Average Frame Time:\n$(obs:average_frame_time)',
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

	presets['remainingDiskSpace'] = {
		type: 'button',
		category: 'General',
		name: 'Remaining Disk Space',
		style: {
			text: 'Disk Space Remaining:\\n$(obs:free_disk_space)',
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
				feedbackId: 'freeDiskSpaceRemaining',
				options: {
					diskSpace: 50000,
				},
				style: {
					bgcolor: Color.Yellow,
					color: Color.White,
				},
			},
			{
				feedbackId: 'freeDiskSpaceRemaining',
				options: {
					diskSpace: 10000,
				},
				style: {
					bgcolor: Color.Red,
					color: Color.White,
				},
			},
		],
	}
	presets['uiHeader'] = {
		type: 'text',
		category: 'General',
		name: 'UI',
		text: '',
	}

	presets['toggleStudioMode'] = {
		type: 'button',
		category: 'General',
		name: 'Toggle Studio Mode',
		style: {
			text: 'ENABLE\\nStudio Mode',
			size: 'auto',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'toggle_studio_mode',
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'studioMode',
				options: {},
				style: {
					text: 'DISABLE\\nStudio Mode',
				},
			},
		],
	}

	presets['takeScreenshot'] = {
		type: 'button',
		category: 'General',
		name: 'Take Screenshot',
		style: {
			text: 'Take Screenshot',
			size: 12,
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'take_screenshot',
						options: {
							format: 'png',
							compression: 0,
							source: 'programScene',
							customName: false,
							path: '',
							prefix: 'Screenshot_$(internal:date_iso)_$(internal:time_hms) ',
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['playPauseCurrentMedia'] = {
		type: 'button',
		category: 'Media Sources',
		name: 'Play/Pause Current Media',
		style: {
			text: 'Play/\\nPause:\\n$(obs:current_media_name)',
			size: 'auto',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'play_pause_media',
						options: {
							source: 'currentMedia',
							playPause: 'toggle',
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	for (const mediaSource of this.obsState.mediaSourceList) {
		const sourceName = mediaSource.label.replace(/[\W]/gi, '_')
		presets[`toggleMedia_${mediaSource.id}`] = {
			type: 'button',
			category: 'Media Sources',
			name: `Play Pause ${mediaSource.label}`,
			style: {
				text: `${mediaSource.label}\\n$(obs:media_status_${sourceName})`,
				size: 'auto',
				color: Color.White,
				bgcolor: Color.Black,
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'play_pause_media',
							options: {
								source: mediaSource.id,
								playPause: 'toggle',
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'media_playing',
					options: {
						source: mediaSource.id,
					},
					style: {
						bgcolor: Color.Green,
						color: Color.White,
					},
				},
			],
		}
	}

	for (const profile of this.obsState.profileChoices) {
		const profileName = profile.label.replace(/[^\w]/gi, '_')
		presets[`profile_${profileName}`] = {
			type: 'button',
			category: 'Profiles',
			name: profile.label,
			style: {
				text: profile.label,
				size: 'auto',
				color: Color.White,
				bgcolor: Color.Black,
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'set_profile',
							options: {
								profile: profile.id,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'profile_active',
					options: {
						profile: profile.id,
					},
					style: {
						bgcolor: Color.Green,
						color: Color.White,
					},
				},
			],
		}
	}
	for (const sceneCollection of this.obsState.sceneCollectionList) {
		const sceneCollectionName = sceneCollection.label.replace(/[^\w]/gi, '_')
		presets[`sceneCollection_${sceneCollectionName}`] = {
			type: 'button',
			category: 'Scene Collections',
			name: sceneCollection.label,
			style: {
				text: sceneCollection.label,
				size: 'auto',
				color: Color.White,
				bgcolor: Color.Black,
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'set_scene_collection',
							options: {
								scene_collection: sceneCollection.id,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'scene_collection_active',
					options: {
						scene_collection: sceneCollection.id,
					},
					style: {
						bgcolor: Color.Green,
						color: Color.White,
					},
				},
			],
		}
	}

	return presets
}
