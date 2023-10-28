import { combineRgb } from '@companion-module/base'

export function getFeedbacks() {
	const feedbacks = {}

	const ColorWhite = combineRgb(255, 255, 255)
	const ColorBlack = combineRgb(0, 0, 0)
	const ColorRed = combineRgb(200, 0, 0)
	const ColorGreen = combineRgb(0, 200, 0)
	const ColorOrange = combineRgb(255, 102, 0)

	feedbacks['streaming'] = {
		type: 'boolean',
		name: 'Streaming Active',
		description: 'If streaming is active, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [],
		callback: () => {
			return this.states.streaming
		},
	}

	feedbacks['recording'] = {
		type: 'advanced',
		name: 'Recording Status',
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
		type: 'advanced',
		name: 'Scene in Preview / Program',
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
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: this.sceneListDefault,
				choices: this.sceneChoices,
				minChoicesForSearch: 5,
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

	feedbacks['sceneProgram'] = {
		type: 'boolean',
		name: 'Scene in Program',
		description: 'If a scene is in program, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorRed,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: this.sceneListDefault,
				choices: this.sceneChoices,
				minChoicesForSearch: 5,
			},
		],
		callback: (feedback) => {
			return this.states.programScene === feedback.options.scene
		},
	}

	feedbacks['scenePreview'] = {
		type: 'boolean',
		name: 'Scene in Preview',
		description: 'If a scene is in preview, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: this.sceneListDefault,
				choices: this.sceneChoices,
				minChoicesForSearch: 5,
			},
		],
		callback: (feedback) => {
			return this.states.previewScene === feedback.options.scene
		},
	}

	feedbacks['scene_item_active'] = {
		type: 'boolean',
		name: 'Source Visible in Program',
		description: 'If a source is visible in the program, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorRed,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: 'anyScene',
				choices: this.sceneChoicesAnyScene,
			},
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: this.sourceListDefault,
				choices: this.sourceChoices,
			},
		],
		callback: (feedback) => {
			if (this.sources[feedback.options.source]?.active && feedback.options.scene === 'anyScene') {
				return true
			} else if (this.sources[feedback.options.source]?.active && feedback.options.scene === this.states.programScene) {
				return true
			}
		},
	}

	feedbacks['scene_item_previewed'] = {
		type: 'boolean',
		name: 'Source Active in Preview',
		description: 'If a source is enabled in the preview scene, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: this.sourceListDefault,
				choices: this.sourceChoices,
				minChoicesForSearch: 5,
			},
		],
		callback: (feedback) => {
			return this.sources[feedback.options.source]?.videoShowing
		},
	}

	feedbacks['profile_active'] = {
		type: 'boolean',
		name: 'Profile Active',
		description: 'If a profile is active, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Profile name',
				id: 'profile',
				default: this.profileChoicesDefault,
				choices: this.profileChoices,
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
		name: 'Scene Collection Active',
		description: 'If a scene collection is active, change the style of the button',
		defaultStyle: {
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
		name: 'Source Enabled in Scene',
		description: 'If a source is enabled in a specific scene, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: this.sceneListDefault,
				choices: this.sceneChoices,
				minChoicesForSearch: 5,
			},
			{
				type: 'checkbox',
				label: 'Any Source',
				id: 'any',
				default: false,
			},
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.sourceListDefault,
				choices: this.sourceChoices,
				minChoicesForSearch: 5,
			},
		],
		callback: (feedback) => {
			if (feedback.options.any) {
				let scene = this.sceneItems[feedback.options.scene]

				if (scene) {
					let enabled = this.sceneItems[feedback.options.scene].find((item) => item.sceneItemEnabled === true)
					if (enabled) {
						return true
					}
				}
			} else {
				if (this.sources[feedback.options.source]?.groupedSource) {
					let group = this.sources[feedback.options.source].groupName
					let sceneItem = this.groups[group].find((item) => item.sourceName === feedback.options.source)
					if (sceneItem) {
						return sceneItem.sceneItemEnabled
					}
				} else if (this.sceneItems[feedback.options.scene]) {
					let sceneItem = this.sceneItems[feedback.options.scene].find(
						(item) => item.sourceName === feedback.options.source
					)
					if (sceneItem) {
						return sceneItem.sceneItemEnabled
					}
				}
			}
		},
	}

	feedbacks['output_active'] = {
		type: 'boolean',
		name: 'Output Active',
		description: 'If an output is currently active, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorGreen,
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
		name: 'Replay Buffer Active',
		description: 'If the replay buffer is currently active, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorRed,
		},
		options: [],
		callback: () => {
			return this.states.replayBuffer
		},
	}

	feedbacks['transition_active'] = {
		type: 'boolean',
		name: 'Transition in Progress',
		description: 'If a transition is in progress, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [],
		callback: () => {
			return this.states.transitionActive
		},
	}

	feedbacks['current_transition'] = {
		type: 'boolean',
		name: 'Current Transition Type',
		description: 'If a transition type is selected, change the style of the button',
		defaultStyle: {
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
		name: 'Transition Duration',
		description: 'If the transition duration is matched, change the style of the button',
		defaultStyle: {
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
		name: 'Filter Enabled',
		description: 'If a filter is enabled, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.sourceListDefault,
				choices: this.sourceChoicesWithScenes,
			},
			{
				type: 'dropdown',
				label: 'Filter',
				id: 'filter',
				default: this.filterListDefault,
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
		name: 'Audio Muted',
		description: 'If an audio source is muted, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorRed,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: this.audioSourceListDefault,
				choices: this.audioSourceList,
			},
		],
		callback: (feedback) => {
			return this.sources[feedback.options.source]?.inputMuted
		},
	}

	feedbacks['audio_monitor_type'] = {
		type: 'boolean',
		name: 'Audio Monitor Type',
		description: 'If the audio monitor type is matched, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorRed,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.audioSourceListDefault,
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
		name: 'Volume',
		description: 'If an audio source volume is matched, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: this.audioSourceListDefault,
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
		name: 'Media Playing',
		description: 'If a media source is playing, change the style of the button',
		defaultStyle: {
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
		name: 'Media Source Remaining Time',
		description: 'If remaining time of a media source is below a threshold, change the style of the button',
		defaultStyle: {
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

	feedbacks['studioMode'] = {
		type: 'boolean',
		name: 'Studio Mode Active',
		description: 'If Studio Mode is active, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [],
		callback: () => {
			return this.states.studioMode
		},
	}

	feedbacks['streamCongestion'] = {
		type: 'advanced',
		name: 'Stream Congestion',
		description: 'Change the style of the button to show stream congestion',
		options: [],
		callback: () => {
			if (this.states.streamCongestion > 0.8) {
				return { bgcolor: ColorRed }
			} else if (this.states.congestion > 0.4) {
				return { bgcolor: ColorOrange }
			} else {
				return { bgcolor: ColorGreen }
			}
		},
	}

	feedbacks['audioPeaking'] = {
		type: 'boolean',
		name: 'Audio Peaking',
		description: 'If audio is above a certain dB value, change the style of the button',
		defaultStyle: {
			color: ColorBlack,
			bgcolor: ColorRed,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: this.audioSourceListDefault,
				choices: this.audioSourceList,
			},
			{
				type: 'number',
				label: 'Peak in dB (-100 to 26) ',
				id: 'peak',
				default: 0,
				min: -100,
				max: 26,
				range: false,
			},
		],
		callback: (feedback) => {
			return this.audioPeak?.[feedback.options.source] > feedback.options.peak
		},
	}

	feedbacks['audioMeter'] = {
		type: 'advanced',
		name: 'Audio Meter',
		description: 'Change the style of the button to show audio meter colors similar to the OBS UI',
		options: [
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: this.audioSourceListDefault,
				choices: this.audioSourceList,
			},
		],
		callback: (feedback) => {
			let peak = this.audioPeak?.[feedback.options.source]
			if (peak > -9) {
				return { bgcolor: ColorRed }
			} else if (peak > -20) {
				return { bgcolor: ColorOrange }
			} else {
				return { bgcolor: ColorGreen }
			}
		},
	}

	feedbacks['vendorEvent'] = {
		type: 'boolean',
		name: 'Vendor Event',
		description: 'Change the style of the button based on third party vendor events',
		options: [
			{
				type: 'textinput',
				label: 'vendorName',
				id: 'vendorName',
				default: 'downstream-keyer',
			},
			{
				type: 'textinput',
				label: 'eventType',
				id: 'eventType',
				default: 'dsk_scene_changed',
			},
			{
				type: 'textinput',
				label: 'eventData Key',
				id: 'eventDataKey',
				default: 'new_scene',
			},
			{
				type: 'textinput',
				label: 'eventData Value',
				id: 'eventDataValue',
				default: 'Scene 1',
			},
		],
		callback: (feedback) => {
			if (this.vendorEvent) {
				if (this.vendorEvent.vendorName == feedback.options.vendorName) {
					if (this.vendorEvent.eventType == feedback.options.eventType) {
						if (this.vendorEvent.eventData) {
							let key = this.vendorEvent.eventData[feedback.options.eventDataKey]
							if (key && key == feedback.options.eventDataValue) {
								return true
							}
						}
					}
				}
			}
		},
	}

	return feedbacks
}
