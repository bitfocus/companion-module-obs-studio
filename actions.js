const hotkeys = require('./hotkeys')

module.exports = {
	getActions() {
		let actions = {}

		this.organizeChoices()

		let sceneListToggle = [
			{ id: 'Current Scene', label: 'Current Scene' },
			{ id: 'Preview Scene', label: 'Preview Scene' },
		].concat(this.sceneList)

		let sceneListCustom = [{ id: 'customSceneName', label: '<CUSTOM SCENE NAME>' }].concat(this.sceneList)

		let sourceListAll = [{ id: 'allSources', label: '<ALL SOURCES>' }].concat(this.sourceList)
		let mediaSourceListCurrent = [{ id: 'currentMedia', label: '<CURRENT MEDIA>' }].concat(this.mediaSourceList)

		let sourceListDefault = this.sourceList?.[0] ? this.sourceList?.[0]?.id : ''
		let sceneListDefault = this.sceneList?.[0] ? this.sceneList?.[0]?.id : ''
		let mediaSourceListDefault = this.mediaSourceList?.[0] ? this.mediaSourceList?.[0]?.id : ''
		let filterListDefault = this.filterList?.[0] ? this.filterList?.[0]?.id : ''
		let audioSourceListDefault = this.audioSourceList?.[0] ? this.audioSourceList?.[0]?.id : ''

		actions['enable_studio_mode'] = {
			label: 'Enable Studio Mode',
		}
		actions['disable_studio_mode'] = {
			label: 'Disable Studio Mode',
		}
		actions['toggle_studio_mode'] = {
			label: 'Toggle Studio Mode',
		}
		actions['start_recording'] = {
			label: 'Start Recording',
		}
		actions['stop_recording'] = {
			label: 'Stop Recording',
		}
		actions['pause_recording'] = {
			label: 'Pause Recording',
		}
		actions['resume_recording'] = {
			label: 'Resume Recording',
		}
		actions['start_streaming'] = {
			label: 'Start Streaming',
		}
		actions['stop_streaming'] = {
			label: 'Stop Streaming',
		}
		actions['StartStopStreaming'] = {
			label: 'Toggle Streaming',
		}
		actions['start_replay_buffer'] = {
			label: 'Start Replay Buffer',
		}
		actions['stop_replay_buffer'] = {
			label: 'Stop Replay Buffer',
		}
		actions['save_replay_buffer'] = {
			label: 'Save Replay Buffer',
		}
		actions['set_scene'] = {
			label: 'Set Program Scene',
			options: [
				{
					type: 'dropdown',
					label: 'Scene',
					id: 'scene',
					default: sceneListDefault,
					choices: sceneListCustom,
				},
				{
					type: 'textwithvariables',
					label: 'Custom Scene Name',
					id: 'customSceneName',
					default: '',
					isVisible: (action) => action.options.scene === 'customSceneName',
				},
			],
		}
		actions['preview_scene'] = {
			label: 'Set Preview Scene',
			options: [
				{
					type: 'dropdown',
					label: 'Scene',
					id: 'scene',
					default: sceneListDefault,
					choices: sceneListCustom,
				},
				{
					type: 'textwithvariables',
					label: 'Custom Scene Name',
					id: 'customSceneName',
					default: '',
					isVisible: (action) => action.options.scene === 'customSceneName',
				},
			],
		}
		actions['smart_switcher'] = {
			label: 'Smart Scene Switcher',
			description: 'Previews selected scene or, if scene is already in preview, transitions the scene to program',
			options: [
				{
					type: 'dropdown',
					label: 'Scene',
					id: 'scene',
					default: sceneListDefault,
					choices: sceneListCustom,
				},
				{
					type: 'textwithvariables',
					label: 'Custom Scene Name',
					id: 'customSceneName',
					default: '',
					isVisible: (action) => action.options.scene === 'customSceneName',
				},
			],
		}
		actions['do_transition'] = {
			label: 'Transition',
			description: 'Transitions preview to program in Studio Mode',
		}
		actions['quick_transition'] = {
			label: 'Quick Transition',
			description: 'Performs the selected transition and then returns to the default transition',
			options: [
				{
					type: 'dropdown',
					label: 'Transition',
					id: 'transition',
					default: this.transitionList?.[0] ? this.transitionList[0].id : '',
					choices: this.transitionList,
				},
				{
					type: 'number',
					label: 'Duration (optional; in ms)',
					id: 'transition_time',
					default: null,
					min: 0,
					max: 60 * 1000, //max is required by api
					range: false,
				},
			],
		}
		actions['set_transition'] = {
			label: 'Set Transition Type',
			options: [
				{
					type: 'dropdown',
					label: 'Transitions',
					id: 'transitions',
					default: this.transitionList?.[0] ? this.transitionList[0].id : '',
					choices: this.transitionList,
				},
			],
		}
		actions['set_transition_duration'] = {
			label: 'Set Transition Duration',
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
		}
		actions['set_stream_settings'] = {
			label: 'Set Stream Settings',
			options: [
				{
					type: 'dropdown',
					label: 'Stream Type',
					id: 'streamType',
					choices: [
						{ id: 'rtmp_common', label: 'Preset Service' },
						{ id: 'rtmp_custom', label: 'Custom' },
					],
					default: 'rtmp_custom',
				},
				{
					type: 'textinput',
					label: 'Stream URL',
					id: 'streamURL',
					default: '',
					isVisible: (action) => action.options.streamType === 'rtmp_custom',
				},
				{
					type: 'textinput',
					label: 'Stream Key',
					id: 'streamKey',
					default: '',
				},
				{
					type: 'checkbox',
					label: 'Use Authentication',
					id: 'streamAuth',
					default: false,
					isVisible: (action) => action.options.streamType === 'rtmp_custom',
				},
				{
					type: 'textinput',
					label: 'User Name (Optional)',
					id: 'streamUserName',
					default: '',
					isVisible: (action) => action.options.streamType === 'rtmp_custom',
				},
				{
					type: 'textinput',
					label: 'Password (Optional)',
					id: 'streamPassword',
					default: '',
					isVisible: (action) => action.options.streamType === 'rtmp_custom',
				},
			],
		}
		actions['SendStreamCaption'] = {
			label: 'Send Stream Caption',
			options: [
				{
					type: 'textwithvariables',
					label: 'Caption Text',
					id: 'text',
					default: '',
				},
			],
		}
		actions['StartStopRecording'] = {
			label: 'Toggle Recording',
		}
		actions['set_source_mute'] = {
			label: 'Set Source Mute',
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
					label: 'Mute',
					id: 'mute',
					default: 'true',
					choices: [
						{ id: 'false', label: 'False' },
						{ id: 'true', label: 'True' },
					],
				},
			],
		}
		actions['toggle_source_mute'] = {
			label: 'Toggle Source Mute',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: audioSourceListDefault,
					choices: this.audioSourceList,
				},
			],
		}
		actions['set_volume'] = {
			label: 'Set Source Volume',
			description: 'Sets the volume of a source to a specific value',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
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
		}
		actions['adjust_volume'] = {
			label: 'Adjust Source Volume',
			description: 'Adjusts the volume of a source by a specific increment',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: audioSourceListDefault,
					choices: this.audioSourceList,
				},
				{
					type: 'number',
					label: 'Volume adjustment amount in dB',
					id: 'volume',
					default: 0,
					range: false,
				},
			],
		}
		actions['setSyncOffset'] = {
			label: 'Set Audio Sync Offset',
			description: 'Sets the sync offset of an audio source',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: audioSourceListDefault,
					choices: this.audioSourceList,
				},
				{
					type: 'number',
					label: 'Sync Offset in ms (-950 to 20000)',
					id: 'offset',
					default: 0,
					min: -950,
					max: 20000,
					range: false,
				},
			],
		}
		actions['setAudioBalance'] = {
			label: 'Set Audio Balance',
			description: 'Sets the balance of an audio source',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: audioSourceListDefault,
					choices: this.audioSourceList,
				},
				{
					type: 'number',
					label: 'Balance (Left 0.0 to 1.0 Right)',
					id: 'balance',
					default: 0.5,
					min: 0.0,
					max: 1.0,
					range: false,
				},
			],
		}
		actions['toggle_scene_item'] = {
			label: 'Set Source Visibility',
			description: 'Set or toggle the visibility of a source within a scene',
			options: [
				{
					type: 'dropdown',
					label: 'Scene (optional, defaults to current scene)',
					id: 'scene',
					default: 'Current Scene',
					choices: sceneListToggle,
				},
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: 'allSources',
					choices: sourceListAll,
				},
				{
					type: 'dropdown',
					label: 'Visible',
					id: 'visible',
					default: 'toggle',
					choices: [
						{ id: 'false', label: 'False' },
						{ id: 'true', label: 'True' },
						{ id: 'toggle', label: 'Toggle' },
					],
				},
			],
		}
		actions['setText'] = {
			label: 'Set Source Text',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: this.textSourceList?.[0] ? this.textSourceList[0].id : 'None',
					choices: this.textSourceList,
				},
				{
					type: 'textwithvariables',
					label: 'Text',
					id: 'text',
				},
			],
		}
		actions['trigger-hotkey'] = {
			label: 'Trigger Hotkey by ID',
			options: [
				{
					type: 'dropdown',
					label: 'Hotkey ID',
					id: 'id',
					default: 'OBSBasic.StartRecording',
					choices: this.hotkeyNames,
				},
			],
		}
		actions['trigger-hotkey-sequence'] = {
			label: 'Trigger Hotkey by Key',
			options: [
				{
					type: 'dropdown',
					label: 'Key',
					id: 'keyId',
					default: 'OBS_KEY_A',
					choices: hotkeys,
				},
				{
					type: 'checkbox',
					label: 'Shift',
					id: 'keyShift',
					default: false,
				},
				{
					type: 'checkbox',
					label: 'Alt / Option',
					id: 'keyAlt',
					default: false,
				},
				{
					type: 'checkbox',
					label: 'Control',
					id: 'keyControl',
					default: false,
				},
				{
					type: 'checkbox',
					label: 'Command (Mac)',
					id: 'keyCommand',
					default: false,
				},
			],
		}
		actions['set_profile'] = {
			label: 'Set Profile',
			options: [
				{
					type: 'dropdown',
					label: 'Profile',
					id: 'profile',
					default: this.profileList?.[0] ? this.profileList[0].id : '',
					choices: this.profileList,
				},
			],
		}
		actions['set_scene_collection'] = {
			label: 'Set Scene Collection',
			options: [
				{
					type: 'dropdown',
					label: 'Scene Collection',
					id: 'scene_collection',
					default: this.sceneCollectionList?.[0] ? this.sceneCollectionList[0].id : '',
					choices: this.sceneCollectionList,
				},
			],
		}
		actions['start_output'] = {
			label: 'Start Output',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'output',
					default: 'virtualcam_output',
					choices: this.outputList,
				},
			],
		}
		actions['stop_output'] = {
			label: 'Stop Output',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'output',
					default: 'virtualcam_output',
					choices: this.outputList,
				},
			],
		}
		actions['start_stop_output'] = {
			label: 'Toggle Output',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'output',
					default: 'virtualcam_output',
					choices: this.outputList,
				},
			],
		}
		actions['refresh_browser_source'] = {
			label: 'Refresh Browser Source',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: sourceListDefault,
					choices: this.sourceList,
				},
			],
		}
		actions['set_audio_monitor'] = {
			label: 'Set Audio Monitor',
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
						{ id: 'none', label: 'Monitor Off' },
						{ id: 'monitorOnly', label: 'Monitor Only' },
						{ id: 'monitorAndOutput', label: 'Monitor and Output' },
					],
				},
			],
		}
		actions['take_screenshot'] = {
			label: 'Take Screenshot',
			options: [
				{
					type: 'dropdown',
					label: 'Format',
					id: 'format',
					default: 'png',
					choices: this.imageFormats,
				},
				{
					type: 'number',
					label: 'Compression Quality (1-100, 0 is automatic)',
					id: 'compression',
					default: 0,
					min: 0,
					max: 100,
					range: false,
				},
				{
					type: 'dropdown',
					label: 'Source (Optional, default is current scene)',
					id: 'source',
					default: sourceListDefault,
					choices: this.sourceList,
				},
				{
					type: 'textinput',
					label: 'Custom File Path (Optional, default is recording path)',
					id: 'path',
				},
			],
		}
		actions['toggle_filter'] = {
			label: 'Set Source Filter Visibility',
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
				{
					type: 'dropdown',
					label: 'Visibility',
					id: 'visible',
					default: 'toggle',
					choices: [
						{ id: 'toggle', label: 'Toggle' },
						{ id: 'true', label: 'On' },
						{ id: 'false', label: 'Off' },
					],
				},
			],
		}
		actions['play_pause_media'] = {
			label: 'Play / Pause Media',
			options: [
				{
					type: 'dropdown',
					label: 'Media Source',
					id: 'source',
					default: 'currentMedia',
					choices: mediaSourceListCurrent,
				},
				{
					type: 'dropdown',
					label: 'Action',
					id: 'playPause',
					default: 'toggle',
					choices: [
						{ id: 'toggle', label: 'Toggle' },
						{ id: 'false', label: 'Play' },
						{ id: 'true', label: 'Pause' },
					],
				},
			],
		}
		actions['restart_media'] = {
			label: 'Restart Media',
			options: [
				{
					type: 'dropdown',
					label: 'Media Source',
					id: 'source',
					default: 'currentMedia',
					choices: mediaSourceListCurrent,
				},
			],
		}
		actions['stop_media'] = {
			label: 'Stop Media',
			options: [
				{
					type: 'dropdown',
					label: 'Media Source',
					id: 'source',
					default: 'currentMedia',
					choices: mediaSourceListCurrent,
				},
			],
		}
		actions['next_media'] = {
			label: 'Next Media',
			options: [
				{
					type: 'dropdown',
					label: 'Media Source',
					id: 'source',
					default: 'currentMedia',
					choices: mediaSourceListCurrent,
				},
			],
		}
		actions['previous_media'] = {
			label: 'Previous Media',
			options: [
				{
					type: 'dropdown',
					label: 'Media Source',
					id: 'source',
					default: 'currentMedia',
					choices: mediaSourceListCurrent,
				},
			],
		}
		actions['set_media_time'] = {
			label: 'Set Media Time',
			options: [
				{
					type: 'dropdown',
					label: 'Media Source',
					id: 'source',
					default: 'currentMedia',
					choices: mediaSourceListCurrent,
				},
				{
					type: 'number',
					label: 'Timecode (in seconds)',
					id: 'mediaTime',
					default: 1,
				},
			],
		}
		actions['scrub_media'] = {
			label: 'Scrub Media',
			options: [
				{
					type: 'dropdown',
					label: 'Media Source',
					id: 'source',
					default: 'currentMedia',
					choices: mediaSourceListCurrent,
				},
				{
					type: 'number',
					label: 'Scrub Amount (in seconds, positive or negative)',
					id: 'scrubAmount',
					default: 1,
				},
			],
		}
		actions['open_projector'] = {
			label: 'Open Projector',
			options: [
				{
					type: 'dropdown',
					label: 'Projector Type',
					id: 'type',
					default: 'Multiview',
					choices: [
						{ id: 'Multiview', label: 'Multiview' },
						{ id: 'Preview', label: 'Preview' },
						{ id: 'StudioProgram', label: 'Program' },
						{ id: 'Source', label: 'Source' },
						{ id: 'Scene', label: 'Scene' },
					],
				},
				{
					type: 'dropdown',
					label: 'Window Type',
					id: 'window',
					default: 'window',
					choices: [
						{ id: 'window', label: 'Window' },
						{ id: 'fullscreen', label: 'Fullscreen' },
					],
				},
				{
					type: 'dropdown',
					label: 'Display',
					id: 'display',
					default: 0,
					choices: this.monitors,
					isVisible: (action) => action.options.window === 'fullscreen',
				},
				{
					type: 'dropdown',
					label: 'Source / Scene (required if selected as projector type)',
					id: 'source',
					default: sourceListDefault,
					choices: this.sourceList,
					isVisible: (action) => action.options.type === 'Source' || action.options.type === 'Scene',
				},
			],
		}
		actions['source_properties'] = {
			label: 'Set Source Transform',
			description: 'All transform values optional, any parameter left blank is ignored',
			options: [
				{
					type: 'dropdown',
					label: 'Scene (optional, defaults to current scene)',
					id: 'scene',
					default: 'Current Scene',
					choices: sceneListToggle,
				},
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: sourceListDefault,
					choices: this.sourceList,
				},
				{
					type: 'textwithvariables',
					label: 'Position - X (pixels)',
					id: 'positionX',
					default: '',
				},
				{
					type: 'textwithvariables',
					label: 'Position - Y (pixels)',
					id: 'positionY',
					default: '',
				},
				{
					type: 'textwithvariables',
					label: 'Scale - X (multiplier, 1 is 100%)',
					id: 'scaleX',
					default: '',
				},
				{
					type: 'textwithvariables',
					label: 'Scale - Y (multiplier, 1 is 100%)',
					id: 'scaleY',
					default: '',
				},
				{
					type: 'textwithvariables',
					label: 'Rotation (degrees clockwise)',
					id: 'rotation',
					default: '',
				},
			],
		}
		actions['openInputPropertiesDialog'] = {
			label: 'Open Source Properties Window',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: sourceListDefault,
					choices: this.sourceList,
				},
			],
		}
		actions['openInputFiltersDialog'] = {
			label: 'Open Source Filters Window',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: sourceListDefault,
					choices: this.sourceList,
				},
			],
		}
		actions['openInputInteractDialog'] = {
			label: 'Open Source Interact Window',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: sourceListDefault,
					choices: this.sourceList,
				},
			],
		}
		actions['custom_command'] = {
			label: 'Custom Command',
			options: [
				{
					type: 'textinput',
					label: 'Request Type',
					id: 'command',
					default: 'SetCurrentProgramScene',
				},
				{
					type: 'textinput',
					label: 'Request Data (optional, JSON formatted)',
					id: 'arg',
					default: '{"sceneName": "Scene 1"}',
				},
			],
		}

		return actions
	},
}
