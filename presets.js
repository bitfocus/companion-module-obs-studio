exports.getPresets = function () {
	//let presets = []
	/* for (var s in self.scenelist) {
		var scene = self.scenelist[s]

		let baseObj = {
			category: 'Scene to Program',
			label: scene.label,
			bank: {
				style: 'text',
				text: scene.label,
				size: 'auto',
				color: self.rgb(255, 255, 255),
				bgcolor: 0,
			},
			feedbacks: [
				{
					type: 'scene_active',
					options: {
						bg: self.rgb(200, 0, 0),
						fg: self.rgb(255, 255, 255),
						bg_preview: self.rgb(0, 200, 0),
						fg_preview: self.rgb(255, 255, 255),
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
							bg: self.rgb(200, 0, 0),
							fg: self.rgb(255, 255, 255),
							bg_preview: self.rgb(0, 200, 0),
							fg_preview: self.rgb(255, 255, 255),
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
			color: self.rgb(255, 255, 255),
			bgcolor: 0,
		},
		actions: [
			{
				action: 'do_transition',
				options: {
					transition: 'Default',
				},
			},
		],
		feedbacks: [
			{
				type: 'transition_active',
				style: {
					bgcolor: self.rgb(0, 200, 0),
					color: self.rgb(255, 255, 255),
				},
			},
		],
	})

	for (var s in self.transitionlist) {
		var transition = self.transitionlist[s]

		let baseObj = {
			category: 'Transitions',
			label: transition.label,
			bank: {
				style: 'text',
				text: transition.label,
				size: 14,
				color: self.rgb(255, 255, 255),
				bgcolor: 0,
			},
			feedbacks: [
				{
					type: 'transition_active',
					style: {
						bgcolor: self.rgb(0, 200, 0),
						color: self.rgb(255, 255, 255),
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
			color: self.rgb(255, 255, 255),
			bgcolor: 0,
		},
		feedbacks: [
			{
				type: 'streaming',
				style: {
					bgcolor: self.rgb(0, 200, 0),
					color: self.rgb(255, 255, 255),
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
			color: self.rgb(255, 255, 255),
			bgcolor: 0,
		},
		feedbacks: [
			{
				type: 'streaming',
				style: {
					bgcolor: self.rgb(0, 200, 0),
					color: self.rgb(255, 255, 255),
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
			color: self.rgb(255, 255, 255),
			bgcolor: 0,
		},
		feedbacks: [
			{
				type: 'recording',
				options: {
					bg: self.rgb(200, 0, 0),
					fg: self.rgb(255, 255, 255),
					bg_paused: self.rgb(212, 174, 0),
					fg_paused: self.rgb(255, 255, 255),
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
			color: self.rgb(255, 255, 255),
			bgcolor: 0,
		},
		feedbacks: [
			{
				type: 'recording',
				options: {
					bg: self.rgb(200, 0, 0),
					fg: self.rgb(255, 255, 255),
					bg_paused: self.rgb(212, 174, 0),
					fg_paused: self.rgb(255, 255, 255),
				},
			},
		],
		actions: [
			{
				action: 'StartStopRecording',
			},
		],
	})

	for (var s in self.outputlist) {
		let output = self.outputlist[s]

		let baseObj = {
			category: 'Outputs',
			label: 'Toggle ' + output.label,
			bank: {
				style: 'text',
				text: 'OBS ' + output.label,
				size: 'auto',
				color: self.rgb(255, 255, 255),
				bgcolor: 0,
			},
			feedbacks: [
				{
					type: 'output_active',
					options: {
						output: output.id,
					},
					style: {
						bgcolor: self.rgb(0, 200, 0),
						color: self.rgb(255, 255, 255),
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

	for (var s in self.sourcelist) {
		let source = self.sourcelist[s]

		let baseObj = {
			category: 'Sources',
			label: source.label + 'Status',
			bank: {
				style: 'text',
				text: source.label,
				size: 'auto',
				color: self.rgb(255, 255, 255),
				bgcolor: 0,
			},
			feedbacks: [
				{
					type: 'scene_item_previewed',
					options: {
						source: source.id,
					},
					style: {
						bgcolor: self.rgb(0, 200, 0),
						color: self.rgb(255, 255, 255),
					},
				},
				{
					type: 'scene_item_active',
					options: {
						source: source.id,
					},
					style: {
						bgcolor: self.rgb(200, 0, 0),
						color: self.rgb(255, 255, 255),
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
			color: self.rgb(255, 255, 255),
			bgcolor: 0,
		},
	})

	for (var s in self.mediaSourceList) {
		let mediaSource = self.mediaSourceList[s]

		let baseObj = {
			category: 'Media Sources',
			label: 'Play Pause' + mediaSource.label,
			bank: {
				style: 'text',
				text: mediaSource.label + '\\n$(obs:media_status_' + mediaSource.label + ')',
				size: 'auto',
				color: self.rgb(255, 255, 255),
				bgcolor: 0,
			},
			feedbacks: [
				{
					type: 'media_playing',
					options: {
						source: mediaSource.id,
					},
					style: {
						bgcolor: self.rgb(0, 200, 0),
						color: self.rgb(255, 255, 255),
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

	return presets */
}
