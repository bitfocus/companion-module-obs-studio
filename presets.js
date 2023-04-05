import { combineRgb } from '@companion-module/base'

export function getPresets() {
	let presets = {}

	const ColorWhite = combineRgb(255, 255, 255)
	const ColorBlack = combineRgb(0, 0, 0)
	const ColorRed = combineRgb(200, 0, 0)
	const ColorGreen = combineRgb(0, 200, 0)
	const ColorYellow = combineRgb(212, 174, 0)

	for (let s in this.sceneChoices) {
		let scene = this.sceneChoices[s]

		presets[`toProgram_${scene.id}`] = {
			type: 'button',
			category: 'Scene to Program',
			name: scene.label,
			style: {
				text: scene.label,
				size: 'auto',
				color: ColorWhite,
				bgcolor: 0,
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
						bgcolor: ColorRed,
						color: ColorWhite,
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
				color: ColorWhite,
				bgcolor: 0,
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
						bgcolor: ColorGreen,
						color: ColorWhite,
					},
				},
			],
		}
	}

	presets['transitionAuto'] = {
		type: 'button',
		category: 'Transitions',
		name: 'Send previewed scene to program',
		style: {
			text: 'AUTO',
			size: 'auto',
			color: ColorWhite,
			bgcolor: 0,
		},
		steps: [
			{
				down: [
					{
						actionId: 'do_transition',
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'transition_active',
				style: {
					bgcolor: ColorGreen,
					color: ColorWhite,
				},
			},
		],
	}

	for (let s in this.transitionList) {
		let transition = this.transitionList[s]

		presets[`quickTransition_${transition.id}`] = {
			type: 'button',
			category: 'Transitions',
			name: transition.label,
			style: {
				text: transition.label,
				size: 14,
				color: ColorWhite,
				bgcolor: 0,
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
					style: {
						bgcolor: ColorGreen,
						color: ColorWhite,
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
			text: 'OBS STREAM',
			size: 'auto',
			color: ColorWhite,
			bgcolor: 0,
		},
		steps: [
			{
				down: [
					{
						actionId: 'StartStopStreaming',
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'streaming',
				style: {
					bgcolor: ColorGreen,
					color: ColorWhite,
				},
			},
		],
	}

	presets['streamingTimecode'] = {
		type: 'button',
		category: 'Streaming',
		name: 'Streaming Status / Timecode',
		style: {
			text: 'Streaming:\\n$(obs:streaming)\\n$(obs:stream_timecode)',
			size: 14,
			color: ColorWhite,
			bgcolor: 0,
		},
		steps: [
			{
				down: [
					{
						actionId: 'StartStopStreaming',
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'streaming',
				style: {
					bgcolor: ColorGreen,
					color: ColorWhite,
				},
			},
		],
	}

	presets['streamingService'] = {
		type: 'button',
		category: 'Streaming',
		name: 'Streaming Service Info',
		style: {
			text: '$(obs:stream_service)\\n$(obs:streaming)',
			size: 'auto',
			color: ColorWhite,
			bgcolor: 0,
		},
		steps: [
			{
				down: [
					{
						actionId: 'StartStopStreaming',
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'streaming',
				style: {
					bgcolor: ColorGreen,
					color: ColorWhite,
				},
			},
		],
	}

	// Preset for Start Recording button with colors indicating recording status
	presets['recording'] = {
		type: 'button',
		category: 'Recording',
		name: 'OBS Recording',
		style: {
			text: 'OBS RECORD',
			size: 'auto',
			color: ColorWhite,
			bgcolor: 0,
		},
		steps: [
			{
				down: [
					{
						actionId: 'StartStopRecording',
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'recording',
				options: {
					bg: ColorRed,
					fg: ColorWhite,
					bg_paused: ColorYellow,
					fg_paused: ColorWhite,
				},
			},
		],
	}

	presets['recordingTimecode'] = {
		type: 'button',
		category: 'Recording',
		name: 'Recording Status / Timecode',
		style: {
			text: 'Recording:\\n$(obs:recording)\\n$(obs:recording_timecode)',
			size: 'auto',
			color: ColorWhite,
			bgcolor: 0,
		},
		steps: [
			{
				down: [
					{
						actionId: 'StartStopRecording',
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'recording',
				options: {
					bg: ColorRed,
					fg: ColorWhite,
					bg_paused: ColorYellow,
					fg_paused: ColorWhite,
				},
			},
		],
	}

	for (let s in this.outputList) {
		let output = this.outputList[s]

		presets[`toggleOutput_${output.id}`] = {
			type: 'button',
			category: 'Outputs',
			name: `Toggle ${output.label}`,
			style: {
				text: `OBS ${output.label}`,
				size: 'auto',
				color: ColorWhite,
				bgcolor: 0,
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
						bgcolor: ColorGreen,
						color: ColorWhite,
					},
				},
			],
		}
	}

	for (let s in this.sourceChoices) {
		let source = this.sourceChoices[s]

		presets[`sourceStatus_${source.id}`] = {
			type: 'button',
			category: 'Sources',
			name: `${source.label} Status`,
			style: {
				text: source.label,
				size: 'auto',
				color: ColorWhite,
				bgcolor: 0,
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
						bgcolor: ColorGreen,
						color: ColorWhite,
					},
				},
				{
					feedbackId: 'scene_item_active',
					options: {
						source: source.id,
					},
					style: {
						bgcolor: ColorRed,
						color: ColorWhite,
					},
				},
			],
		}
	}

	presets['computerStats'] = {
		type: 'button',
		category: 'General',
		name: 'Computer Stats',
		style: {
			text: 'CPU:\\n$(obs:cpu_usage)\\nRAM:\\n$(obs:memory_usage)',
			size: 'auto',
			color: ColorWhite,
			bgcolor: 0,
		},
		steps: [{}],
		feedbacks: [],
	}

	presets['toggleStudioMode'] = {
		type: 'button',
		category: 'General',
		name: 'Toggle Studio Mode',
		style: {
			text: 'Toggle Studio Mode',
			size: 'auto',
			color: ColorWhite,
			bgcolor: 0,
		},
		steps: [
			{
				down: [
					{
						actionId: 'toggle_studio_mode',
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['takeScreenshot'] = {
		type: 'button',
		category: 'General',
		name: 'Take Screenshot',
		style: {
			text: 'Take Screenshot',
			size: 7,
			color: ColorWhite,
			bgcolor: 0,
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
							path: '',
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
			color: ColorWhite,
			bgcolor: 0,
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

	for (let s in this.mediaSourceList) {
		let mediaSource = this.mediaSourceList[s]
		let sourceName = mediaSource.label.replace(/[\W]/gi, '_')
		presets[`toggleMedia_${mediaSource.id}`] = {
			type: 'button',
			category: 'Media Sources',
			name: `Play Pause ${mediaSource.label}`,
			style: {
				text: `${mediaSource.label}\\n$(obs:media_status_${sourceName})`,
				size: 'auto',
				color: ColorWhite,
				bgcolor: 0,
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
						bgcolor: ColorGreen,
						color: ColorWhite,
					},
				},
			],
		}
	}

	return presets
}
