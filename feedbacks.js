exports.initFeedbacks = function () {
	const feedbacks = {}

	const ColorWhite = this.rgb(255, 255, 255)
	const ColorBlack = this.rgb(0, 0, 0)
	const ColorRed = this.rgb(200, 0, 0)
	const ColorGreen = this.rgb(0, 200, 0)
	const ColorOrange = this.rgb(255, 102, 0)

	feedbacks['streaming'] = {
		type: 'boolean',
		label: 'Streaming Active',
		description: 'If streaming is active, change the style of the button',
		style: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		callback: () => {
			return this.states.streaming
		},
	}

	feedbacks['recording'] = {
		label: 'Recording Status',
		description: 'If recording is active or paused, change the style of the button',
		options: [
			{
				type: 'colorpicker',
				label: 'Foreground color (Recording)',
				id: 'fg',
				default: ColorWhite,
			},
			{
				type: 'colorpicker',
				label: 'Background color (Recording)',
				id: 'bg',
				default: ColorRed,
			},
			{
				type: 'colorpicker',
				label: 'Foreground color (Paused)',
				id: 'fg_paused',
				default: ColorWhite,
			},
			{
				type: 'colorpicker',
				label: 'Background color (Paused)',
				id: 'bg_paused',
				default: ColorOrange,
			},
		],
		callback: (feedback) => {
			if (this.states.recording === 'Recording') {
				return { color: feedback.options.fg, bgcolor: feedback.options.bg }
			} else if (this.states.recording === 'Paused') {
				return { color: feedback.options.fg_paused, bgcolor: feedback.options.bg_paused }
			} else {
				return {}
			}
		},
	}

	feedbacks['scene_active'] = {
		label: 'Scene in Preview / Program',
		description: 'If a scene is in preview or program, change colors of the button',
		options: [
			{
				type: 'dropdown',
				label: 'Mode',
				id: 'mode',
				default: 'programAndPreview',
				choices: [
					{ id: 'programAndPreview', label: 'Program and Preview' },
					{ id: 'program', label: 'Program Only' },
					{ id: 'preview', label: 'Preview Only' },
				],
			},
			{
				type: 'colorpicker',
				label: 'Foreground color (Program)',
				id: 'fg',
				default: ColorWhite,
			},
			{
				type: 'colorpicker',
				label: 'Background color (Program)',
				id: 'bg',
				default: ColorRed,
			},
			{
				type: 'colorpicker',
				label: 'Foreground color (Preview)',
				id: 'fg_preview',
				default: ColorWhite,
			},
			{
				type: 'colorpicker',
				label: 'Background color (Preview)',
				id: 'bg_preview',
				default: ColorGreen,
			},
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: this.scenelistDefault,
				choices: this.scenelist,
				minChoicesForSearch: 5,
			},
		],
		callback: (feedback) => {
			let mode = feedback.options.mode
			if (!mode) {
				mode = 'programAndPreview'
			}
			if (
				this.states['scene_active'] === feedback.options.scene &&
				(mode === 'programAndPreview' || mode === 'program')
			) {
				return { color: feedback.options.fg, bgcolor: feedback.options.bg }
			} else if (
				this.states['scene_preview'] === feedback.options.scene &&
				typeof feedback.options.fg_preview === 'number' &&
				this.states['studio_mode'] === true &&
				(mode === 'programAndPreview' || mode === 'preview')
			) {
				return { color: feedback.options.fg_preview, bgcolor: feedback.options.bg_preview }
			} else {
				return {}
			}
		},
	}

	feedbacks['scene_item_active'] = {
		type: 'boolean',
		label: 'Source Visible in Program',
		description: 'If a source is visible in the program, change the style of the button',
		style: {
			color: ColorWhite,
			bgcolor: ColorRed,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: this.sourcelistDefault,
				choices: this.sourceList,
				minChoicesForSearch: 5,
			},
		],
		callback: (feedback) => {
			if (this.sources[feedback.options.source]?.active) {
				return true
			}
		},
	}

	/* feedbacks['scene_item_previewed'] = {
		type: 'boolean',
		label: 'Source Active in Preview',
		description: 'If a source is enabled in the preview scene, change the style of the button',
		style: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: this.sourcelistDefault,
				choices: this.sourcelist,
				minChoicesForSearch: 5,
			},
		],
	} */

	feedbacks['profile_active'] = {
		type: 'boolean',
		label: 'Profile Active',
		description: 'If a profile is active, change the style of the button',
		style: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Profile name',
				id: 'profile',
				default: this.profileList?.[0] ? this.profileList[0].id : '',
				choices: this.profileList,
				minChoicesForSearch: 5,
			},
		],
		callback: (feedback) => {
			if (this.states.currentProfile === feedback.options.profile) {
				return true
			}
		},
	}

	feedbacks['scene_collection_active'] = {
		type: 'boolean',
		label: 'Scene Collection Active',
		description: 'If a scene collection is active, change the style of the button',
		style: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Scene collection name',
				id: 'scene_collection',
				default: this.sceneCollectionList?.[0] ? this.sceneCollectionList[0].id : '',
				choices: this.sceneCollectionList,
				minChoicesForSearch: 5,
			},
		],
		callback: (feedback) => {
			if (this.states.currentSceneCollection === feedback.options.scene_collection) {
				return true
			}
		},
	}

	/* feedbacks['scene_item_active_in_scene'] = {
		type: 'boolean',
		label: 'Source Enabled in Scene',
		description: 'If a source is enabled in a specific scene, change the style of the button',
		style: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Scene name',
				id: 'scene',
				default: this.scenelistDefault,
				choices: this.scenelist,
				minChoicesForSearch: 5,
			},
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: this.sourcelistDefault,
				choices: [{ id: 'anySource', label: '<ANY SOURCE>' }, ...this.sourcelist],
				minChoicesForSearch: 5,
			},
		],
	}

	feedbacks['output_active'] = {
		type: 'boolean',
		label: 'Output Active',
		description: 'If an output is currently active, change the style of the button',
		style: {
			color: ColorWhite,
			bgcolor: ColorRed,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Output name',
				id: 'output',
				default: 'virtualcam_output',
				choices: this.outputlist,
				minChoicesForSearch: 3,
			},
		],
	} */

	feedbacks['transition_active'] = {
		type: 'boolean',
		label: 'Transition in Progress',
		description: 'If a transition is in progress, change the style of the button',
		style: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		callback: () => {
			return this.states.transitionActive
		},
	}

	feedbacks['current_transition'] = {
		type: 'boolean',
		label: 'Current Transition Type',
		description: 'If a transition type is selected, change the style of the button',
		style: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Transition',
				id: 'transition',
				default: this.transitionList?.[0] ? this.transitionList[0].id : '',
				choices: this.transitionList,
				minChoicesForSearch: 5,
			},
		],
		callback: (feedback) => {
			if (this.states.currentTransition === feedback.options.transition) {
				return true
			}
		},
	}

	feedbacks['transition_duration'] = {
		type: 'boolean',
		label: 'Transition Duration',
		description: 'If the transition duration is matched, change the style of the button',
		style: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [
			{
				type: 'number',
				label: 'Transition time (in ms)',
				id: 'duration',
				default: null,
				min: 0,
				max: 60 * 1000, //max is required by api
				range: false,
			},
		],
		callback: (feedback) => {
			if (this.states.transitionDuration === feedback.options.duration) {
				return true
			}
		},
	}

	/* feedbacks['filter_enabled'] = {
		type: 'boolean',
		label: 'Filter Enabled',
		description: 'If a filter is enabled, change the style of the button',
		style: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.sourcelistDefault,
				choices: this.sourcelist,
			},
			{
				type: 'dropdown',
				label: 'Filter',
				id: 'filter',
				default: this.filterlistDefault,
				choices: this.filterlist,
			},
		],
	}

	feedbacks['audio_muted'] = {
		type: 'boolean',
		label: 'Audio Muted',
		description: 'If an audio source is muted, change the style of the button',
		style: {
			color: ColorWhite,
			bgcolor: ColorRed,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: this.sourcelistDefault,
				choices: this.sourcelist,
				minChoicesForSearch: 5,
			},
		],
	}

	feedbacks['audio_monitor_type'] = {
		type: 'boolean',
		label: 'Audio Monitor Type',
		description: 'If the audio monitor type is matched, change the style of the button',
		style: {
			color: ColorWhite,
			bgcolor: ColorRed,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: this.sourcelistDefault,
				choices: this.sourcelist,
				minChoicesForSearch: 5,
			},
			{
				type: 'dropdown',
				label: 'Monitor',
				id: 'monitor',
				default: 'none',
				choices: [
					{ id: 'none', label: 'None' },
					{ id: 'monitorOnly', label: 'Monitor Only' },
					{ id: 'monitorAndOutput', label: 'Monitor and Output' },
				],
				required: true,
			},
		],
	}

	feedbacks['volume'] = {
		type: 'boolean',
		label: 'Volume',
		description: 'If an audio source volume is matched, change the style of the button',
		style: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: this.sourcelistDefault,
				choices: this.sourcelist,
				minChoicesForSearch: 5,
			},
			{
				type: 'number',
				label: 'Volume in dB (-100 to 26) ',
				id: 'volume',
				default: 0,
				min: -100,
				max: 26,
				range: false,
				required: false,
			},
		],
	}

	feedbacks['media_playing'] = {
		type: 'boolean',
		label: 'Media Playing',
		description: 'If a media source is playing, change the style of the button',
		style: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Media Source',
				id: 'source',
				default: this.mediaSourceList?.[0] ? this.mediaSourceList[0].id : '',
				choices: this.mediaSourceList,
				minChoicesForSearch: 5,
			},
		],
	}

	feedbacks['media_source_time_remaining'] = {
		type: 'boolean',
		label: 'Media Source Remaining Time',
		description: 'If remaining time of a media source is below a threshold, change the style of the button',
		style: {
			color: ColorBlack,
			bgcolor: ColorRed,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: this.mediaSourceList?.[0] ? this.mediaSourceList[0].id : '',
				choices: this.mediaSourceList,
				minChoicesForSearch: 5,
			},
			{
				type: 'number',
				label: 'Remaining time threshold (in seconds)',
				id: 'rtThreshold',
				default: 20,
				min: 0,
				max: 3600, //max is required by api
				range: false,
			},
			{
				type: 'checkbox',
				label: 'Feedback only if source is on program',
				id: 'onlyIfSourceIsOnProgram',
				default: false,
			},
			{
				type: 'checkbox',
				label: 'Feedback only if source is playing',
				id: 'onlyIfSourceIsPlaying',
				default: false,
			},
			{
				type: 'checkbox',
				label: 'Blinking',
				id: 'blinkingEnabled',
				default: false,
			},
		],
	} */

	this.setFeedbackDefinitions(feedbacks)

	return feedbacks
}
