exports.initFeedbacks = function () {
	const feedbacks = {}

	const ColorWhite = this.rgb(255, 255, 255)
	const ColorBlack = this.rgb(0, 0, 0)
	const ColorRed = this.rgb(200, 0, 0)
	const ColorGreen = this.rgb(0, 200, 0)
	const ColorOrange = this.rgb(255, 102, 0)

	let sourceListDefault = this.sourceList?.[0] ? this.sourceList?.[0]?.id : ''
	let sceneListDefault = this.sceneList?.[0] ? this.sceneList?.[0]?.id : ''
	let filterListDefault = this.filterList?.[0] ? this.filterList?.[0]?.id : ''
	let audioSourceListDefault = this.audioSourceList?.[0] ? this.audioSourceList?.[0]?.id : ''

	let sourceListAll = [{ id: 'anySource', label: '<ANY SOURCE>' }].concat(this.sourceList)

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
				default: sceneListDefault,
				choices: this.sceneList,
				minChoicesForSearch: 5,
			},
		],
		callback: (feedback) => {
			let mode = feedback.options.mode
			if (!mode) {
				mode = 'programAndPreview'
			}
			if (this.states.programScene === feedback.options.scene && (mode === 'programAndPreview' || mode === 'program')) {
				return { color: feedback.options.fg, bgcolor: feedback.options.bg }
			} else if (
				this.states.previewScene === feedback.options.scene &&
				typeof feedback.options.fg_preview === 'number' &&
				this.states.studioMode === true &&
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
				default: sourceListDefault,
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

	feedbacks['scene_item_previewed'] = {
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
				default: sourceListDefault,
				choices: this.sourceList,
				minChoicesForSearch: 5,
			},
		],
		callback: (feedback) => {
			return this.sources[feedback.options.source]?.videoShowing
		},
	}

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

	feedbacks['scene_item_active_in_scene'] = {
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
				default: sceneListDefault,
				choices: this.sceneList,
				minChoicesForSearch: 5,
			},
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: sourceListDefault,
				choices: sourceListAll,
				minChoicesForSearch: 5,
			},
		],
		callback: (feedback) => {
			if (this.sceneItems[feedback.options.scene]) {
				if (feedback.options.source !== 'allSources ') {
					let sceneItem = this.sceneItems[feedback.options.scene].find(
						(item) => item.sourceName === feedback.options.source
					)
					if (sceneItem) {
						return sceneItem.sceneItemEnabled
					}
				} else {
					//check all sources
				}
			}
		},
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
				choices: this.outputList,
				minChoicesForSearch: 3,
			},
		],
		callback: (feedback) => {
			return this.outputs[feedback.options.output]?.outputActive
		},
	}

	feedbacks['replayBufferActive'] = {
		type: 'boolean',
		label: 'Replay Buffer Active',
		description: 'If the replay buffer is currently active, change the style of the button',
		style: {
			color: ColorWhite,
			bgcolor: ColorRed,
		},
		callback: () => {
			return this.states.replayBuffer
		},
	}

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

	feedbacks['filter_enabled'] = {
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
				default: sourceListDefault,
				choices: this.sourceList,
			},
			{
				type: 'dropdown',
				label: 'Filter',
				id: 'filter',
				default: filterListDefault,
				choices: this.filterList,
			},
		],
		callback: (feedback) => {
			if (this.sourceFilters[feedback.options.source]) {
				let filter = this.sourceFilters[feedback.options.source].find(
					(item) => item.filterName === feedback.options.filter
				)
				if (filter) {
					return filter.filterEnabled
				}
			}
		},
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
				default: audioSourceListDefault,
				choices: this.audioSourceList,
			},
		],
		callback: (feedback) => {
			return this.sources[feedback.options.source]?.inputMuted
		},
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
				label: 'Source',
				id: 'source',
				default: audioSourceListDefault,
				choices: this.audioSourceList,
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
			},
		],
		callback: (feedback) => {
			let monitorType
			if (feedback.options.monitor === 'monitorAndOutput') {
				monitorType = 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT'
			} else if (feedback.options.monitor === 'monitorOnly') {
				monitorType = 'OBS_MONITORING_TYPE_MONITOR_ONLY'
			} else {
				monitorType = 'OBS_MONITORING_TYPE_NONE'
			}
			return this.sources[feedback.options.source]?.monitorType == monitorType
		},
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
				default: audioSourceListDefault,
				choices: this.audioSourceList,
			},
			{
				type: 'number',
				label: 'Volume in dB (-100 to 26) ',
				id: 'volume',
				default: 0,
				min: -100,
				max: 26,
				range: false,
			},
		],
		callback: (feedback) => {
			return this.sources[feedback.options.source]?.inputVolume == feedback.options.volume
		},
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
			},
		],
		callback: (feedback) => {
			return this.mediaSources[feedback.options.source]?.mediaState == 'OBS_MEDIA_STATE_PLAYING'
		},
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
		callback: (feedback) => {
			let remainingTime // remaining time in seconds
			let mediaState
			if (this.mediaSources[feedback.options.source]) {
				remainingTime = Math.round(
					(this.mediaSources[feedback.options.source].mediaDuration -
						this.mediaSources[feedback.options.source].mediaCursor) /
						1000
				)
				mediaState = this.mediaSources[feedback.options.source].mediaState
			}
			if (remainingTime === undefined) return false

			if (feedback.options.onlyIfSourceIsOnProgram && !this.sources[feedback.options.source].active) {
				return false
			}

			if (feedback.options.onlyIfSourceIsPlaying && mediaState !== 'OBS_MEDIA_STATE_PLAYING') {
				return false
			}

			if (remainingTime <= feedback.options.rtThreshold) {
				if (feedback.options.blinkingEnabled && mediaState === 'OBS_MEDIA_STATE_PLAYING') {
					// TODO: implement a better button blinking, or wait for https://github.com/bitfocus/companion/issues/674
					if (remainingTime % 2 != 0) {
						// flash in seconds interval (checkFeedbacks interval = media poller interval)
						return false
					}
				}
				return true
			}
		},
	}

	this.setFeedbackDefinitions(feedbacks)

	return feedbacks
}
