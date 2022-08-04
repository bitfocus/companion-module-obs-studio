exports.getPresets = function () {
	let presets = []

	const ColorWhite = this.rgb(255, 255, 255)
	const ColorBlack = this.rgb(0, 0, 0)
	const ColorRed = this.rgb(200, 0, 0)
	const ColorGreen = this.rgb(0, 200, 0)
	const ColorYellow = this.rgb(212, 174, 0)

	for (let s in this.sceneChoices) {
		let scene = this.sceneChoices[s]

		let baseObj = {
			category: 'Scene to Program',
			label: scene.label,
			bank: {
				style: 'text',
				text: scene.label,
				size: 'auto',
				color: ColorWhite,
				bgcolor: 0,
			},
			feedbacks: [
				{
					type: 'scene_active',
					options: {
						bg: ColorRed,
						fg: ColorWhite,
						bg_preview: ColorGreen,
						fg_preview: ColorWhite,
						scene: scene.id,
					},
				},
			],
			actions: [
				{
					action: 'set_scene',
					options: {
						scene: scene.id,
					},
				},
			],
		}

		presets.push(baseObj)

		let toPreview = {}
		presets.push(
			Object.assign(toPreview, baseObj, {
				category: 'Scene to Preview',
				actions: [
					{
						action: 'preview_scene',
						options: {
							scene: scene.id,
						},
					},
				],
				feedbacks: [
					{
						type: 'scene_active',
						options: {
							bg: ColorRed,
							fg: ColorWhite,
							bg_preview: ColorGreen,
							fg_preview: ColorWhite,
							scene: scene.id,
						},
					},
				],
			})
		)
	}

	presets.push({
		category: 'Transitions',
		label: 'Send previewed scene to program',
		bank: {
			style: 'text',
			text: 'AUTO',
			size: 'auto',
			color: ColorWhite,
			bgcolor: 0,
		},
		actions: [
			{
				action: 'do_transition',
			},
		],
		feedbacks: [
			{
				type: 'transition_active',
				style: {
					bgcolor: ColorGreen,
					color: ColorWhite,
				},
			},
		],
	})

	for (let s in this.transitionList) {
		let transition = this.transitionList[s]

		let baseObj = {
			category: 'Transitions',
			label: transition.label,
			bank: {
				style: 'text',
				text: transition.label,
				size: 14,
				color: ColorWhite,
				bgcolor: 0,
			},
			feedbacks: [
				{
					type: 'transition_active',
					style: {
						bgcolor: ColorGreen,
						color: ColorWhite,
					},
				},
			],
			actions: [
				{
					action: 'quick_transition',
					options: {
						transition: transition.id,
					},
				},
			],
		}
		presets.push(baseObj)
	}

	// Preset for Start Streaming button with colors indicating streaming status
	presets.push({
		category: 'Streaming',
		label: 'OBS Streaming',
		bank: {
			style: 'text',
			text: 'OBS STREAM',
			size: 'auto',
			color: ColorWhite,
			bgcolor: 0,
		},
		feedbacks: [
			{
				type: 'streaming',
				style: {
					bgcolor: ColorGreen,
					color: ColorWhite,
				},
			},
		],
		actions: [
			{
				action: 'StartStopStreaming',
			},
		],
	})

	presets.push({
		category: 'Streaming',
		label: 'Streaming Status / Timecode',
		bank: {
			style: 'text',
			text: 'Streaming:\\n$(obs:streaming)\\n$(obs:stream_timecode)',
			size: 14,
			color: ColorWhite,
			bgcolor: 0,
		},
		feedbacks: [
			{
				type: 'streaming',
				style: {
					bgcolor: ColorGreen,
					color: ColorWhite,
				},
			},
		],
		actions: [
			{
				action: 'StartStopStreaming',
			},
		],
	})

	presets.push({
		category: 'Streaming',
		label: 'Streaming Service Info',
		bank: {
			style: 'text',
			text: '$(obs:stream_service)\\n$(obs:streaming)',
			size: 'auto',
			color: ColorWhite,
			bgcolor: 0,
		},
		feedbacks: [
			{
				type: 'streaming',
				style: {
					bgcolor: ColorGreen,
					color: ColorWhite,
				},
			},
		],
		actions: [
			{
				action: 'StartStopStreaming',
			},
		],
	})

	// Preset for Start Recording button with colors indicating recording status
	presets.push({
		category: 'Recording',
		label: 'OBS Recording',
		bank: {
			style: 'text',
			text: 'OBS RECORD',
			size: 'auto',
			color: ColorWhite,
			bgcolor: 0,
		},
		feedbacks: [
			{
				type: 'recording',
				options: {
					bg: ColorRed,
					fg: ColorWhite,
					bg_paused: ColorYellow,
					fg_paused: ColorWhite,
				},
			},
		],
		actions: [
			{
				action: 'StartStopRecording',
			},
		],
	})

	presets.push({
		category: 'Recording',
		label: 'Recording Status / Timecode',
		bank: {
			style: 'text',
			text: 'Recording:\\n$(obs:recording)\\n$(obs:recording_timecode)',
			size: 'auto',
			color: ColorWhite,
			bgcolor: 0,
		},
		feedbacks: [
			{
				type: 'recording',
				options: {
					bg: ColorRed,
					fg: ColorWhite,
					bg_paused: ColorYellow,
					fg_paused: ColorWhite,
				},
			},
		],
		actions: [
			{
				action: 'StartStopRecording',
			},
		],
	})

	for (let s in this.outputList) {
		let output = this.outputList[s]

		let baseObj = {
			category: 'Outputs',
			label: 'Toggle ' + output.label,
			bank: {
				style: 'text',
				text: 'OBS ' + output.label,
				size: 'auto',
				color: ColorWhite,
				bgcolor: 0,
			},
			feedbacks: [
				{
					type: 'output_active',
					options: {
						output: output.id,
					},
					style: {
						bgcolor: ColorGreen,
						color: ColorWhite,
					},
				},
			],
			actions: [
				{
					action: 'start_stop_output',
					options: {
						output: output.id,
					},
				},
			],
		}
		presets.push(baseObj)
	}

	for (let s in this.sourceChoices) {
		let source = this.sourceChoices[s]

		let baseObj = {
			category: 'Sources',
			label: source.label + 'Status',
			bank: {
				style: 'text',
				text: source.label,
				size: 'auto',
				color: ColorWhite,
				bgcolor: 0,
			},
			feedbacks: [
				{
					type: 'scene_item_previewed',
					options: {
						source: source.id,
					},
					style: {
						bgcolor: ColorGreen,
						color: ColorWhite,
					},
				},
				{
					type: 'scene_item_active',
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
		presets.push(baseObj)
	}

	presets.push({
		category: 'General',
		label: 'Computer Stats',
		bank: {
			style: 'text',
			text: 'CPU:\\n$(obs:cpu_usage)\\nRAM:\\n$(obs:memory_usage)',
			size: 'auto',
			color: ColorWhite,
			bgcolor: 0,
		},
	})

	presets.push({
		category: 'General',
		label: 'Toggle Studio Mode',
		bank: {
			style: 'text',
			text: 'Toggle Studio Mode',
			size: 'auto',
			color: ColorWhite,
			bgcolor: 0,
		},
		actions: [
			{
				action: 'toggle_studio_mode',
			},
		],
	})

	presets.push({
		category: 'General',
		label: 'Take Screenshot',
		bank: {
			style: 'text',
			text: 'Take Screenshot',
			size: 7,
			color: ColorWhite,
			bgcolor: 0,
		},
		actions: [
			{
				action: 'take_screenshot',
				options: {
					format: 'png',
					compression: 0,
					source: 'programScene',
					path: '',
				},
			},
		],
	})

	presets.push({
		category: 'Media Sources',
		label: 'Computer Stats',
		bank: {
			style: 'text',
			text: 'Play/\\nPause:\\n$(obs:current_media_name)',
			size: 'auto',
			color: ColorWhite,
			bgcolor: 0,
		},
		actions: [
			{
				action: 'play_pause_media',
				options: {
					source: 'currentMedia',
					playPause: 'toggle',
				},
			},
		],
	})

	for (let s in this.mediaSourceList) {
		let mediaSource = this.mediaSourceList[s]

		let baseObj = {
			category: 'Media Sources',
			label: 'Play Pause' + mediaSource.label,
			bank: {
				style: 'text',
				text: mediaSource.label + '\\n$(obs:media_status_' + mediaSource.label + ')',
				size: 'auto',
				color: ColorWhite,
				bgcolor: 0,
			},
			feedbacks: [
				{
					type: 'media_playing',
					options: {
						source: mediaSource.id,
					},
					style: {
						bgcolor: ColorGreen,
						color: ColorWhite,
					},
				},
			],
			actions: [
				{
					action: 'play_pause_media',
					options: {
						source: mediaSource.id,
						playPause: 'toggle',
					},
				},
			],
		}
		presets.push(baseObj)
	}

	return presets
}
