const instance_skel = require('../../instance_skel')
const actions = require('./actions')
const presets = require('./presets')
const { updateVariableDefinitions } = require('./variables')
const { initFeedbacks } = require('./feedbacks')
//const upgradeScripts = require('./upgrades')

const { EventSubscription } = require('obs-websocket-js')

const OBSWebSocket = require('obs-websocket-js').default
const obs = new OBSWebSocket()

let debug
let log

class instance extends instance_skel {
	constructor(system, id, config) {
		super(system, id, config)

		Object.assign(this, {
			...actions,
			...presets,
		})

		this.updateVariableDefinitions = updateVariableDefinitions
	}

	static GetUpgradeScripts() {
		return [
			instance_skel.CreateConvertToBooleanFeedbackUpgradeScript({
				streaming: true,
				scene_item_active: true,
				profile_active: true,
				scene_collection_active: true,
				scene_item_active_in_scene: true,
				output_active: true,
				transition_active: true,
				current_transition: true,
				transition_duration: true,
				filter_enabled: true,
			}),
		]
	}

	config_fields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'IP Address',
				width: 8,
				regex: this.REGEX_IP,
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Port',
				width: 4,
				default: 4455,
				regex: this.REGEX_PORT,
			},
			{
				type: 'textinput',
				id: 'pass',
				label: 'Password',
				width: 4,
			},
		]
	}

	updateConfig(config) {
		this.config = config

		this.status(this.STATUS_WARNING, 'Connecting')

		this.connectOBS()
	}

	destroy() {
		debug('destroy', this.id)
		this.disconnectOBS()
	}

	init() {
		debug = this.debug
		log = this.log

		this.status(this.STATUS_WARNING, 'Connecting')

		this.actions()
		this.initVariables()
		this.initFeedbacks()
		//this.initPresets()
		this.connectOBS()
	}

	initVariables() {
		this.updateVariableDefinitions()
	}

	async connectOBS() {
		if (obs) {
			await obs.disconnect()
		}
		try {
			const { obsWebSocketVersion, negotiatedRpcVersion } = await obs.connect(
				`ws:///${this.config.host}:${this.config.port}`,
				this.config.pass,
				{
					eventSubscriptions:
						EventSubscription.All |
						EventSubscription.InputActiveStateChanged |
						EventSubscription.InputShowStateChanged |
						EventSubscription.SceneItemTransformChanged,
					rpcVersion: 1,
				}
			)
			if (obsWebSocketVersion) {
				this.status(this.STATUS_OK)
				this.log('info', 'Connected to OBS')
				this.obsListeners()
				this.getVersionInfo()
				this.getStats()
				this.getStreamStatus()
				this.getProfileList()
				this.getSceneTransitionList()
				this.getSceneCollectionList()
				this.getRecordStatus()
				this.getScenesSources()
				this.startStatsPoll()

				//Basic Info
				this.scenes = {}
				this.sources = {}
				this.states = {}
				this.transitions = {}
				this.profiles = {}
				this.sceneCollections = {}
				this.outputs = {}
				//Source Types
				this.mediaSources = {}
				this.imageSources = {}
				this.textSources = {}
				this.filters = {}
				this.sourceFilters = {}
				//Choices
				this.sceneList = []
				this.sceneItems = {}
				this.sourceList = []
				this.profileList = []
				this.sceneCollectionList = []
				this.textSourceList = []
				this.mediaSourceList = []
				this.imageSourceList = []
				this.hotkeyNames = []
				this.transitionList = []
			}
		} catch (error) {
			this.debug(error)
			this.status(this.STATUS_ERROR)
			if (error?.message.match(/(Server sent no subprotocol)/i)) {
				this.log('error', 'Failed to connect to OBS. Please upgrade OBS Websocket to version 5.0.0 or above')
			} else {
				this.log('error', `Failed to connect to OBS (${error.code} ${error.message})`)
			}
		}
	}

	async disconnectOBS() {
		if (obs) {
			await obs.disconnect()
			this.stopStatsPoll()
			this.scenes = {}
			this.sources = {}
			this.states = {}
			this.sceneList = []
			this.sourceList = []
			this.profileList = []
			this.sceneCollectionList = []
			this.transitionList = []
		}
	}

	async obsListeners() {
		//General
		obs.once('ExitStarted', () => {
			this.log('warn', 'OBS closed, disconnecting')
		})
		obs.on('VendorEvent', () => {})
		//Config
		obs.on('CurrentSceneCollectionChanging', () => {})
		obs.on('CurrentSceneCollectionChanged', (data) => {
			this.states.currentSceneCollection = data.sceneCollectionName
			this.checkFeedbacks('scene_collection_active')
			this.setVariable('scene_collection', this.states.currentSceneCollection)
		})
		obs.on('SceneCollectionListChanged', () => {
			this.getSceneCollectionList()
		})
		obs.on('CurrentProfileChanging', () => {})
		obs.on('CurrentProfileChanged', (data) => {
			this.states.currentProfile = data.profileName
			this.checkFeedbacks('profile_active')
			this.setVariable('profile', this.states.currentProfile)
		})
		obs.on('ProfileListChanged', () => {
			this.getProfileList()
		})
		//Scenes
		obs.on('SceneCreated', () => {})
		obs.on('SceneRemoved', () => {})
		obs.on('SceneNameChanged', () => {})
		obs.on('CurrentProgramSceneChanged', (data) => {
			this.states.programScene = data.sceneName
			this.setVariable('scene_active', this.states.programScene)
		})
		obs.on('CurrentPreviewSceneChanged', (data) => {
			this.states.previewScene = data.sceneName ? data.sceneName : 'None'
			this.setVariable('scene_preview', this.states.previewScene)
		})
		obs.on('SceneListChanged', () => {})
		//Inputs
		obs.on('InputCreated', () => {})
		obs.on('InputRemoved', () => {})
		obs.on('InputNameChanged', () => {})
		obs.on('InputActiveStateChanged', (data) => {
			if (this.sources[data.inputName]) {
				this.sources[data.inputName].active = data.videoActive
				this.checkFeedbacks('scene_item_active')
			}
		})
		obs.on('InputShowStateChanged', () => {})
		obs.on('InputMuteStateChanged', () => {})
		obs.on('InputVolumeChanged', () => {})
		obs.on('InputAudioBalanceChanged', () => {})
		obs.on('InputAudioSyncOffsetChanged', () => {})
		obs.on('InputAudioTracksChanged', () => {})
		obs.on('InputAudioMonitorTypeChanged', () => {})
		obs.on('InputVolumeMeters', () => {})
		//Transitions
		obs.on('CurrentSceneTransitionChanged', (data) => {
			this.states.currentTransition = data.transitionName
			this.checkFeedbacks('current_transition')
			this.setVariable('current_transition', this.states.currentTransition)
			obs.call('GetCurrentSceneTransition').then((data) => {
				this.states.transitionDuration = data.transitionDuration ? data.transitionDuration : '0'
				this.checkFeedbacks('transition_duration')
				this.setVariable('transition_duration', this.states.transitionDuration)
			})
		})
		obs.on('CurrentSceneTransitionDurationChanged', (data) => {
			this.states.transitionDuration = data.transitionDuration ? data.transitionDuration : '0'
			this.checkFeedbacks('transition_duration')
			this.setVariable('transition_duration', this.states.transitionDuration)
		})
		obs.on('SceneTransitionStarted', () => {
			this.states.transitionActive = true
			this.checkFeedbacks('transition_active')
		})
		obs.on('SceneTransitionEnded', () => {
			this.states.transitionActive = false
			this.checkFeedbacks('transition_active')
		})
		obs.on('SceneTransitionVideoEnded', () => {})
		//Filters
		obs.on('SourceFilterListReindexed', () => {})
		obs.on('SourceFilterCreated', () => {})
		obs.on('SourceFilterRemoved', () => {})
		obs.on('SourceFilterNameChanged', () => {})
		obs.on('SourceFilterEnableStateChanged', () => {})
		//Scene Items
		obs.on('SceneItemCreated', () => {})
		obs.on('SceneItemRemoved', () => {})
		obs.on('SceneItemListReindexed', () => {})
		obs.on('SceneItemEnableStateChanged', () => {})
		obs.on('SceneItemLockStateChanged', () => {})
		obs.on('SceneItemSelected', () => {})
		obs.on('SceneItemTransformChanged', (data) => {
			this.debug(data)
		})
		//Outputs
		obs.on('StreamStateChanged', (data) => {
			this.states.streaming = data.outputActive

			this.setVariable('streaming', this.states.streaming ? 'Live' : 'Off-Air')
			this.checkFeedbacks('streaming')
		})
		obs.on('RecordStateChanged', (data) => {
			if (data.outputActive === true) {
				this.states.recording = 'Recording'
			} else {
				if (data.outputState === 'OBS_WEBSOCKET_OUTPUT_PAUSED') {
					this.states.recording = 'Paused'
				} else {
					this.states.recording = 'Stopped'
				}
			}
			this.setVariable('recording', this.states.recording)
			this.checkFeedbacks('recording')
		})
		obs.on('ReplayBufferStateChanged', () => {})
		obs.on('VirtualcamStateChanged', () => {})
		obs.on('ReplayBufferSaved', () => {})
		//Media Inputs
		obs.on('MediaInputPlaybackStarted', () => {})
		obs.on('MediaInputPlaybackEnded', () => {})
		obs.on('MediaInputActionTriggered', (data) => {})
		//UI
		obs.on('StudioModeStateChanged', (data) => {
			//Not working
		})
	}

	initFeedbacks() {
		const feedbacks = initFeedbacks.bind(this)()
		this.setFeedbackDefinitions(feedbacks)
	}

	initPresets(updates) {
		this.setPresetDefinitions(this.getPresets())
	}

	actions(system) {
		this.setActions(this.getActions())
	}

	action(action) {
		let requestType
		let requestData

		switch (action.action) {
			//General
			case 'trigger-hotkey':
				requestType = 'TriggerHotkeyByName'
				requestData = { hotkeyName: action.options.id }
				break
			case 'trigger-hotkey-sequence':
				let keyModifiers = {
					shift: action.options.keyShift,
					alt: action.options.keyAlt,
					control: action.options.keyControl,
					command: action.options.keyCommand,
				}

				requestType = 'TriggerHotkeyByKeySequence'
				requestData = {
					keyId: action.options.keyId,
					keyModifiers: keyModifiers,
				}
				break
			case 'custom_command':
				let arg
				if (action.options.arg) {
					try {
						arg = JSON.parse(action.options.arg)
					} catch (e) {
						this.log('warn', 'Request data must be formatted as valid JSON.')
						return
					}
				}

				requestType = action.options.command
				requestData = arg
				break
			//Config
			case 'set_profile':
				requestType = 'SetCurrentProfile'
				requestData = { profileName: action.options.profile }
				break
			case 'set_scene_collection':
				requestType = 'SetCurrentSceneCollection'
				requestData = { sceneCollectionName: action.options.scene_collection }
				break
			case 'set_stream_settings':
				let streamServiceSettings = {
					key: action.options.streamKey,
					server: action.options.streamURL,
					use_auth: action.options.streamAuth,
					username: action.options.streamUserName,
					password: action.options.streamPassword,
				}
				let streamServiceType = action.options.streamType
				requestType = 'SetStreamServiceSettings'
				requestData = { streamServiceType: streamServiceType, streamServiceSettings: streamServiceSettings }
				break
			//Sources
			//Scenes
			case 'set_scene':
				requestType = 'SetCurrentProgramScene'
				requestData = { sceneName: action.options.scene }
				break
			case 'preview_scene':
				requestType = 'SetCurrentPreviewScene'
				requestData = { sceneName: action.options.scene }
				break
			case 'smart_switcher':
				if (this.states.previewScene == action.options.scene) {
					requestType = 'TriggerStudioModeTransition'
				} else {
					requestType = 'SetCurrentPreviewScene'
					requestData = { sceneName: action.options.scene }
				}
				break
			//Inputs
			case 'setText':
				let newText
				this.parseVariables(action.options.text, (value) => {
					newText = value
				})
				requestType = 'SetInputSettings'
				requestData = { inputName: action.options.source, inputSettings: { text: newText } }
				break
			//Transitions
			case 'set_transition':
				requestType = 'SetCurrentSceneTransition'
				requestData = { transitionName: action.options.transitions }
				break
			case 'set_transition_duration':
				requestType = 'SetCurrentSceneTransitionDuration'
				requestData = { transitionDuration: action.options.duration }
				break
			//Filters
			//Scene Items
			//Outputs
			case 'ToggleReplayBuffer': //NEW, add to actions help
				requestType = 'ToggleReplayBuffer'
				break
			case 'start_replay_buffer':
				requestType = 'StartReplayBuffer'
				break
			case 'stop_replay_buffer':
				requestType = 'StopReplayBuffer'
				break
			case 'save_replay_buffer':
				requestType = 'SaveReplayBuffer'
				break
			//Stream
			case 'StartStopStreaming':
				requestType = 'ToggleStream'
				break
			case 'start_streaming':
				requestType = 'StartStream'
				break
			case 'stop_streaming':
				requestType = 'StopStream'
				break
			case 'SendStreamCaption': //NEW, add to actions help
				requestType = 'SendStreamCaption'
				requestData = { captionText: '' } //LINK TO TEXT
				break
			//Record
			case 'StartStopRecording':
				requestType = 'ToggleRecord'
				break
			case 'start_recording':
				requestType = 'StartRecord'
				break
			case 'stop_recording':
				requestType = 'StopRecord'
				break
			case 'pause_recording':
				requestType = 'PauseRecord'
				break
			case 'resume_recording':
				requestType = 'ResumeRecord'
				break
			case 'ToggleRecordPause': //NEW, add to actions help
				requestType = 'ToggleRecordPause'
				break
			//Media Inputs
			case 'play_pause_media':
				if (action.options.playPause === 'toggle') {
					//FIX TOGGLE//FIX TOGGLE//FIX TOGGLE
				} else {
					requestType = 'TriggerMediaInputAction'
					requestData = {
						inputName: action.options.source,
						mediaAction:
							action.options.playPause == 'true'
								? 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE'
								: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY',
					}
				}
				break
			case 'restart_media':
				requestType = 'TriggerMediaInputAction'
				requestData = {
					inputName: action.options.source,
					mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART',
				}
				break
			case 'stop_media':
				requestType = 'TriggerMediaInputAction'
				requestData = {
					inputName: action.options.source,
					mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP',
				}
				break
			case 'next_media':
				requestType = 'TriggerMediaInputAction'
				requestData = {
					inputName: action.options.source,
					mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_NEXT',
				}
				break
			case 'previous_media':
				requestType = 'TriggerMediaInputAction'
				requestData = {
					inputName: action.options.source,
					mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PREVIOUS',
				}
				break
			case 'set_media_time':
				requestType = 'SetMediaInputCursor'
				requestData = {
					inputName: action.options.source,
					mediaCursor: action.options.mediaTime * 1000,
				}
				break
			case 'scrub_media':
				requestType = 'OffsetMediaInputCursor'
				requestData = {
					inputName: action.options.source,
					mediaCursorOffset: action.options.scrubAmount * 1000,
				}
				break
			//UI
			case 'enable_studio_mode':
				requestType = 'SetStudioModeEnabled'
				requestData = { studioModeEnabled: true }
				break
			case 'disable_studio_mode':
				requestType = 'SetStudioModeEnabled'
				requestData = { studioModeEnabled: false }
				break
			case 'toggle_studio_mode':
				requestType = 'SetStudioModeEnabled'
				requestData = { studioModeEnabled: this.states.studioMode ? false : true }
				break
			case 'openInputPropertiesDialog':
				requestType = 'OpenInputPropertiesDialog'
				requestData = { inputName: action.options.source }
				break
			case 'openInputFiltersDialog':
				requestType = 'OpenInputFiltersDialog'
				requestData = { inputName: action.options.source }
				break
			case 'openInputInteractDialog':
				requestType = 'OpenInputInteractDialog'
				requestData = { inputName: action.options.source } //PREVENT ERROR IF NOT INTERACTIVE
				break

			/////////UNTESTED BELOW//////

			case 'do_transition':
				var options = {}
				if (action.options && action.options.transition) {
					if (action.options.transition == 'Default') {
						options['with-transition'] = {}
						if (action.options.transition_time > 0) {
							options['with-transition']['duration'] = action.options.transition_time
						}
					} else {
						options['with-transition'] = {
							name: action.options.transition,
						}
						if (action.options.transition_time > 0) {
							options['with-transition']['duration'] = action.options.transition_time
						}
					}
				}
				handle = self.obs.send('TransitionToProgram', options)
				break
			case 'quick_transition':
				if (action.options.transition == 'Default') {
					handle = self.obs.send('TransitionToProgram')
				} else {
					let revertTransition = self.states['current_transition']
					let revertTransitionDuration = self.states['transition_duration']
					if (action.options.transition != 'Cut' && action.options.transition_time > 50) {
						var transitionWaitTime = action.options.transition_time + 50
					} else if (action.options.transition_time == null) {
						var transitionWaitTime = self.states['transition_duration'] + 50
					} else {
						var transitionWaitTime = 100
					}
					if (action.options.transition_time != null) {
						var transitionDuration = action.options.transition_time
					} else {
						var transitionDuration = self.states['transition_duration']
					}
					var requests = [
						{
							'request-type': 'TransitionToProgram',
							'with-transition': {
								name: action.options.transition,
								duration: transitionDuration,
							},
						},
						{
							'request-type': 'Sleep',
							sleepMillis: transitionWaitTime,
						},
						{
							'request-type': 'SetCurrentTransition',
							'transition-name': revertTransition,
						},
						{
							'request-type': 'SetTransitionDuration',
							duration: revertTransitionDuration,
						},
					]
					handle = self.obs.send('ExecuteBatch', { requests })
				}
				break
			case 'set_source_mute':
				handle = self.obs.send('SetMute', {
					source: action.options.source,
					mute: action.options.mute == 'true' ? true : false,
				})
				break
			case 'toggle_source_mute':
				handle = self.obs.send('ToggleMute', {
					source: action.options.source,
				})
				break
			case 'set_volume':
				handle = self.obs.send('SetVolume', {
					source: action.options.source,
					volume: action.options.volume,
					useDecibel: true,
				})
				break
			case 'adjust_volume':
				var newVolume = self.sourceAudio['volume'][action.options.source] + action.options.volume
				if (newVolume > 26) {
					var newVolume = 26
				} else if (newVolume < -100) {
					var newVolume = -100
				}
				handle = self.obs.send('SetVolume', {
					source: action.options.source,
					volume: newVolume,
					useDecibel: true,
				})
				break

			case 'toggle_scene_item':
				let sceneName = action.options.scene
				let sourceName = action.options.source

				// special scene names
				if (!sceneName || sceneName === 'Current Scene') {
					sceneName = self.states['scene_active']
				} else if (sceneName === 'Preview Scene') {
					sceneName = self.states['scene_preview']
				}
				let scene = self.scenes[sceneName]

				let setSourceVisibility = function (sourceName, render) {
					let visible
					if (action.options.visible === 'toggle') {
						visible = !render
					} else {
						visible = action.options.visible == 'true'
					}
					handle = self.obs.send('SetSceneItemProperties', {
						item: sourceName,
						visible: visible,
						'scene-name': sceneName,
					})
				}

				if (scene) {
					let finished = false
					for (let source of scene.sources) {
						// allSources does not include the group, is there any use case for considering groups as well?
						if (source.type === 'group') {
							if (sourceName === source.name) {
								setSourceVisibility(source.name, source.render) // this is the group
								if (sourceName !== 'allSources') break
							}
							for (let sourceGroupChild of source.groupChildren) {
								if (sourceName === 'allSources' || sourceGroupChild.name === sourceName) {
									setSourceVisibility(sourceGroupChild.name, sourceGroupChild.render)
									if (sourceName !== 'allSources') {
										finished = true
										break
									}
								}
							}
							if (finished) break
						} else if (sourceName === 'allSources' || source.name === sourceName) {
							setSourceVisibility(source.name, source.render)
							if (sourceName !== 'allSources') break
						}
					}
				}
				break
			case 'start_output':
				handle = self.obs.send('StartOutput', {
					outputName: action.options.output,
				})
				break
			case 'stop_output':
				handle = self.obs.send('StopOutput', {
					outputName: action.options.output,
				})
				break
			case 'start_stop_output':
				if (self.states[action.options.output] === true) {
					handle = self.obs.send('StopOutput', {
						outputName: action.options.output,
					})
				} else {
					handle = self.obs.send('StartOutput', {
						outputName: action.options.output,
					})
				}
				break
			case 'refresh_browser_source':
				handle = self.obs.send('RefreshBrowserSource', {
					sourceName: action.options.source,
				})
				break
			case 'set_audio_monitor':
				handle = self.obs.send('SetAudioMonitorType', {
					sourceName: action.options.source,
					monitorType: action.options.monitor,
				})
				break
			case 'take_screenshot':
				let date = new Date().toISOString()
				let day = date.slice(0, 10)
				let time = date.slice(11, 19).replaceAll(':', '.')
				let fileName = action.options.source ? action.options.source : self.states['scene_active']
				let fileLocation = action.options.path ? action.options.path : self.states['rec-folder']
				let filePath = fileLocation + '/' + day + '_' + fileName + '_' + time + '.' + action.options.format
				let quality = action.options.compression == 0 ? -1 : action.options.compression
				handle = self.obs.send('TakeSourceScreenshot', {
					sourceName: fileName,
					embedPictureFormat: action.options.format,
					saveToFilePath: filePath,
					fileFormat: action.options.format,
					compressionQuality: quality,
				})
			case 'toggle_filter':
				if (action.options.visible !== 'toggle') {
					var filterVisibility = action.options.visible === 'true' ? true : false
				} else if (action.options.visible === 'toggle') {
					if (self.sourceFilters[action.options.source]) {
						for (s in self.sourceFilters[action.options.source]) {
							let filter = self.sourceFilters[action.options.source][s]
							if (filter.name === action.options.filter) {
								var filterVisibility = !filter.enabled
							}
						}
					}
				}
				handle = self.obs.send('SetSourceFilterVisibility', {
					sourceName: action.options.source,
					filterName: action.options.filter,
					filterEnabled: filterVisibility,
				})
				break

			case 'open_projector':
				let monitor = action.options.window === 'window' ? -1 : action.options.display - 1
				handle = self.obs.send('OpenProjector', {
					type: action.options.type,
					monitor: monitor,
					name: action.options.source,
				})
				break
			case 'source_properties':
				let sourceScene = action.options.scene
				if (action.options.scene == 'Current Scene') {
					sourceScene = self.states['scene_active']
				} else if (action.options.scene == 'Preview Scene') {
					sourceScene = self.states['scene_preview']
				} else {
					sourceScene = action.options.scene
				}
				let positionX
				let positionY
				let scaleX
				let scaleY
				let rotation

				this.parseVariables(action.options.positionX, function (value) {
					positionX = parseFloat(value)
				})
				this.parseVariables(action.options.positionY, function (value) {
					positionY = parseFloat(value)
				})
				this.parseVariables(action.options.scaleX, function (value) {
					scaleX = parseFloat(value)
				})
				this.parseVariables(action.options.scaleY, function (value) {
					scaleY = parseFloat(value)
				})
				this.parseVariables(action.options.rotation, function (value) {
					rotation = parseFloat(value)
				})

				handle = self.obs.send('SetSceneItemProperties', {
					'scene-name': sourceScene,
					item: action.options.source,
					position: {
						x: positionX,
						y: positionY,
					},
					scale: {
						x: scaleX,
						y: scaleY,
					},
					rotation: rotation,
				})
				break
		}

		this.sendRequest(requestType, requestData)
	}

	sendRequest(requestType, requestData) {
		try {
			obs.call(requestType, requestData)
		} catch (error) {
			this.debug(error)
			this.log('warn', `Request ${requestType} failed`)
		}
	}

	getVersionInfo() {
		obs.call('GetVersion').then((data) => {
			this.states.version = data
		})
		obs.call('GetHotkeyList').then((data) => {
			data.hotkeys.forEach((hotkey) => {
				this.hotkeyNames.push({ id: hotkey, label: hotkey })
			})
		})
		obs.call('GetStudioModeEnabled').then((data) => {
			this.states.studioMode = data.studioModeEnabled ? true : false
		})
		obs.call('GetVideoSettings').then((data) => {
			this.states.resolution = `${data.baseWidth}x${data.baseHeight}`
			this.states.outputResolution = `${data.outputWidth}x${data.outputHeight}`
			this.states.framerate = `${data.fpsNumerator / data.fpsDenominator} fps`
			this.setVariable('base_resolution', this.states.resolution)
			this.setVariable('output_resolution', this.states.outputResolution)
			this.setVariable('target_framerate', this.states.framerate)
		})
	}

	roundNumber(number, decimalPlaces) {
		if (number) {
			return Number(Math.round(number + 'e' + decimalPlaces) + 'e-' + decimalPlaces)
		} else {
			return number
		}
	}

	startStatsPoll() {
		if (obs) {
			this.statsPoll = setInterval(() => {
				this.getStats()
				if (this.states.streaming) {
					this.getStreamStatus()
				}
				if (this.states.recording === 'Recording') {
					this.getRecordStatus()
				}
			}, 1000)
		}
	}

	stopStatsPoll() {
		if (this.statsPoll) {
			clearInterval(this.statsPoll)
			delete this.statsPoll
		}
	}

	getStats() {
		obs.call('GetStats').then((data) => {
			this.states.stats = data
			this.setVariable('fps', this.roundNumber(data.activeFps, 2))
			this.setVariable('render_total_frames', data.renderTotalFrames)
			this.setVariable('render_missed_frames', data.renderSkippedFrames)
			this.setVariable('output_total_frames', data.outputTotalFrames)
			this.setVariable('output_skipped_frames', data.outputSkippedFrames)
			this.setVariable('average_frame_time', this.roundNumber(data.averageFrameRenderTime, 2))
			this.setVariable('cpu_usage', this.roundNumber(data.cpuUsage, 2) + '%')
			this.setVariable('memory_usage', this.roundNumber(data.memoryUsage, 0) + ' MB')
			let freeSpace = this.roundNumber(data.availableDiskSpace, 0)
			if (freeSpace > 1000) {
				this.setVariable('free_disk_space', this.roundNumber(freeSpace / 1000, 0) + ' GB')
			} else {
				this.setVariable('free_disk_space', this.roundNumber(freeSpace, 0) + ' MB')
			}
		})
	}

	getStreamStatus() {
		obs.call('GetStreamStatus').then((data) => {
			this.states.streaming = data.outputActive
			this.setVariable('streaming', data.outputActive ? 'Live' : 'Off-Air')
			this.checkFeedbacks('streaming')
			this.states.streamingTimecode = data.outputTimecode.match(/\d\d:\d\d:\d\d/i)
			this.setVariable('stream_timecode', this.states.streamingTimecode)
		})
		obs.call('GetStreamServiceSettings').then((data) => {
			this.setVariable(
				'stream_service',
				data.streamServiceSettings?.service ? data.streamServiceSettings.service : 'Custom'
			)
		})
	}

	getSceneTransitionList() {
		this.transitionList = []
		obs
			.call('GetSceneTransitionList')
			.then((data) => {
				data.transitions.forEach((transition) => {
					this.transitionList.push({ id: transition.transitionName, label: transition.transitionName })
				})
			})

			.then(() => {
				this.actions()
				this.initVariables()
				this.initFeedbacks()
				//this.initPresets()
			})
		obs.call('GetCurrentSceneTransition').then((data) => {
			this.states.currentTransition = data.transitionName
			this.checkFeedbacks('current_transition')
			this.setVariable('current_transition', this.states.currentTransition)

			this.states.transitionDuration = data.transitionDuration ? data.transitionDuration : '0'
			this.checkFeedbacks('transition_duration')
			this.setVariable('transition_duration', this.states.transitionDuration)
		})
	}

	getRecordStatus() {
		obs.call('GetRecordStatus').then((data) => {
			if (data.outputActive === true) {
				this.states.recording = 'Recording'
			} else {
				this.states.recording = data.outputPaused ? 'Paused' : 'Stopped'
			}
			this.setVariable('recording', this.states.recording)
			this.checkFeedbacks('recording')
			this.states.recordingTimecode = data.outputTimecode.match(/\d\d:\d\d:\d\d/i)
			this.setVariable('recording_timecode', this.states.recordingTimecode)
		})
		obs.call('GetRecordDirectory').then((data) => {
			this.states.recordDirectory = data.recordDirectory
			this.setVariable('recording_path', this.states.recordDirectory)
		})
	}

	getProfileList() {
		this.profileList = []
		obs
			.call('GetProfileList')
			.then((data) => {
				this.states.currentProfile = data.currentProfileName
				this.checkFeedbacks('profile_active')
				this.setVariable('profile', this.states.currentProfile)
				data.profiles.forEach((profile) => {
					this.profileList.push({ id: profile, label: profile })
				})
			})
			.then(() => {
				this.actions()
				this.initVariables()
				this.initFeedbacks()
				//this.initPresets()
			})
	}

	getSceneCollectionList() {
		this.sceneCollectionList = []
		obs
			.call('GetSceneCollectionList')
			.then((data) => {
				this.states.currentSceneCollection = data.currentSceneCollectionName
				this.checkFeedbacks('scene_collection_active')
				this.setVariable('scene_collection', this.states.currentSceneCollection)
				data.sceneCollections.forEach((sceneCollection) => {
					this.sceneCollectionList.push({ id: sceneCollection, label: sceneCollection })
				})
			})
			.then(() => {
				this.actions()
				this.initVariables()
				this.initFeedbacks()
				//this.initPresets()
			})
	}
	getSourceAudio(sourceName) {
		obs.call('GetInputMute', { inputName: sourceName }).then((data) => {})
	}

	getScenesSources() {
		obs
			.call('GetSceneList')
			.then((data) => {
				this.scenes = data.scenes
				this.states.previewScene = data.currentPreviewSceneName ? data.currentPreviewSceneName : 'None'
				this.setVariable('scene_preview', this.states.previewScene)
				this.states.programScene = data.currentProgramSceneName
				this.setVariable('scene_active', this.states.programScene)
				return data
			})
			.then((data) => {
				data.scenes.forEach((scene) => {
					let sceneName = scene.sceneName
					this.sceneList.push({ id: sceneName, label: sceneName })

					obs.call('GetSceneItemList', { sceneName: sceneName }).then((data) => {
						this.sceneItems[sceneName] = data.sceneItems
						//this.debug	(this.sceneItems[sceneName])
						this.debug(this.sceneItems)
						data.sceneItems.forEach((sceneItem) => {
							let sourceName = sceneItem.sourceName
							this.sources[sourceName] = sceneItem

							this.sourceList.push({ id: sourceName, label: sourceName })

							obs.call('GetSourceActive', { sourceName: sourceName }).then((active) => {
								this.sources[sourceName].active = active.videoActive
							})
							obs.call('GetSceneItemTransform', { sceneName: sceneName, sceneItemId: sceneItem.sceneItemId }).then((data) => {
								
							})
							//this.getSourceAudio(sourceName) NEEDS TO CHECK IF SOURCE SUPPORTS AUDIO
							if (sceneItem.inputKind) {
								let inputKind = sceneItem.inputKind
								obs.call('GetInputSettings', { inputName: sourceName }).then((settings) => {
									this.sources[sourceName].settings = settings.inputSettings
									if (inputKind === 'text_ft2_source_v2' || inputKind === 'text_gdiplus_v2') {
										this.textSourceList.push({ id: sourceName, label: sourceName })
									}
									if (inputKind === 'ffmpeg_source' || inputKind === 'vlc_source') {
										this.mediaSourceList.push({ id: sourceName, label: sourceName })
									}
									if (inputKind === 'image_source') {
										this.imageSourceList.push({ id: sourceName, label: sourceName })
									}
								})
							}
						})
					})
				})
			})
			.then(() => {
				this.debug('ITEMS')
				this.debug(this.sceneItems)
				this.actions()
				this.initVariables()
				this.initFeedbacks()
				//this.initPresets()
			})
	}
}
exports = module.exports = instance
