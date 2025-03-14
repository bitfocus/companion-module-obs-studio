import { InstanceBase, InstanceStatus, Regex, runEntrypoint } from '@companion-module/base'
import { getActions } from './actions.js'
import { getPresets } from './presets.js'
import { getVariables } from './variables.js'
import { getFeedbacks } from './feedbacks.js'
import UpgradeScripts from './upgrades.js'

import { OBSWebSocket, EventSubscription } from 'obs-websocket-js'

class OBSInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
	}

	//Companion Internal and Configuration
	async init(config) {
		this.config = config
		this.updateStatus(InstanceStatus.Connecting)

		if (this.config.host && this.config.port) {
			this.connectOBS()
		} else if (this.config.host && !this.config.port) {
			this.updateStatus(InstanceStatus.BadConfig, 'Missing WebSocket Server port')
		} else if (!this.config.host && this.config.port) {
			this.updateStatus(InstanceStatus.BadConfig, 'Missing WebSocket Server IP address or hostname')
		} else {
			this.updateStatus(InstanceStatus.BadConfig, 'Missing WebSocket Server connection info')
		}
	}

	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'Server IP / Hostname',
				width: 8,
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Server Port',
				width: 4,
				default: 4455,
				regex: Regex.PORT,
			},
			{
				type: 'textinput',
				id: 'pass',
				label: 'Server Password',
				width: 4,
			},
		]
	}

	async configUpdated(config) {
		this.config = config
		this.init(config)
	}

	async destroy() {
		this.disconnectOBS()
		this.stopReconnectionPoll()
	}

	initVariables() {
		const variables = getVariables.bind(this)()
		this.setVariableDefinitions(variables)
	}

	initFeedbacks() {
		const feedbacks = getFeedbacks.bind(this)()
		this.setFeedbackDefinitions(feedbacks)
	}

	initPresets() {
		const presets = getPresets.bind(this)()
		this.setPresetDefinitions(presets)
	}

	initActions() {
		const actions = getActions.bind(this)()
		this.setActionDefinitions(actions)
	}

	//Utilities
	validName(name) {
		//Generate a valid name for use as a variable ID
		try {
			return name.replace(/[^a-z0-9-_.]+/gi, '_')
		} catch (error) {
			this.log('debug', `Unable to generate validName for ${name}: ${error}`)
			return name
		}
	}

	formatTimecode(data) {
		//Converts milliseconds into a readable time format (hh:mm:ss)
		try {
			let formattedTime = new Date(data).toISOString().slice(11, 19)
			return formattedTime
		} catch (error) {
			this.log('debug', `Error formatting timecode: ${error}`)
		}
	}

	roundNumber(number, decimalPlaces) {
		//Rounds a number to a specified number of decimal places
		try {
			return Number(Math.round(number + 'e' + decimalPlaces ?? 0) + 'e-' + decimalPlaces ?? 0)
		} catch (error) {
			this.log('debug', `Error rounding number ${number}: ${error}`)
			return number
		}
	}

	organizeChoices() {
		//Sort choices alphabetically
		this.sourceChoices?.sort((a, b) => a.id.localeCompare(b.id))
		this.sceneChoices?.sort((a, b) => a.id.localeCompare(b.id))
		this.textSourceList?.sort((a, b) => a.id.localeCompare(b.id))
		this.mediaSourceList?.sort((a, b) => a.id.localeCompare(b.id))
		this.filterList?.sort((a, b) => a.id.localeCompare(b.id))
		this.audioSourceList?.sort((a, b) => a.id.localeCompare(b.id))
		//Special Choices - Scenes
		this.sceneChoicesProgramPreview = [
			{ id: 'Current Scene', label: 'Current Scene' },
			{ id: 'Preview Scene', label: 'Preview Scene' },
		].concat(this.sceneChoices)
		this.sceneChoicesAnyScene = [{ id: 'anyScene', label: '<ANY SCENE>' }].concat(this.sceneChoices)
		this.sceneChoicesCustomScene = [{ id: 'customSceneName', label: '<CUSTOM SCENE NAME>' }].concat(this.sceneChoices)
		//Special Choices - Sources
		this.sourceChoicesWithScenes = this.sourceChoices.concat(this.sceneChoices)
		this.mediaSourceListCurrentMedia = [{ id: 'currentMedia', label: '<CURRENT MEDIA>' }].concat(this.mediaSourceList)
		//Default Choices
		this.sourceListDefault = this.sourceChoices?.[0] ? this.sourceChoices?.[0]?.id : ''
		this.sceneListDefault = this.sceneChoices?.[0] ? this.sceneChoices?.[0]?.id : ''
		this.filterListDefault = this.filterList?.[0] ? this.filterList?.[0]?.id : ''
		this.audioSourceListDefault = this.audioSourceList?.[0] ? this.audioSourceList?.[0]?.id : ''
		this.profileChoicesDefault = this.profileChoices?.[0] ? this.profileChoices[0].id : ''
	}

	updateActionsFeedbacksVariables() {
		this.organizeChoices()

		this.initActions()
		this.initVariables()
		this.initFeedbacks()
		this.initPresets()
		this.checkFeedbacks()
	}

	initializeStates() {
		//Basic Info
		this.scenes = []
		this.sources = {}
		this.states = {}
		this.transitions = {}
		this.profiles = {}
		this.sceneCollections = {}
		this.outputs = {}
		this.sceneItems = {}
		this.groups = {}
		//Source Types
		this.mediaSources = {}
		this.imageSources = {}
		this.textSources = {}
		this.sourceFilters = {}
		//Choices
		this.sceneChoices = []
		this.sourceChoices = []
		this.profileChoices = []
		this.sceneCollectionList = []
		this.textSourceList = []
		this.mediaSourceList = []
		this.imageSourceList = []
		this.hotkeyNames = []
		this.imageFormats = []
		this.transitionList = []
		this.monitors = []
		this.outputList = []
		this.filterList = []
		this.audioSourceList = []
		//Set Initial States
		this.vendorEvent = {}
		this.states.sceneCollectionChanging = false
	}

	resetSceneSourceStates() {
		this.scenes = []
		this.sources = {}
		this.mediaSources = {}
		this.imageSources = {}
		this.textSources = {}
		this.sourceFilters = {}
		this.groups = {}

		this.sceneChoices = []
		this.sourceChoices = []
		this.filterList = []
		this.audioSourceList = []
		this.mediaSourceList = []
		this.textSourceList = []
		this.imageSourceList = []
	}

	//OBS Websocket Connection
	async connectOBS() {
		if (this.obs) {
			this.obs.removeAllListeners()
			await this.obs.disconnect()
		} else {
			this.obs = new OBSWebSocket()
		}
		try {
			const { obsWebSocketVersion } = await this.obs.connect(
				`ws://${this.config.host}:${this.config.port}`,
				this.config.pass,
				{
					eventSubscriptions:
						EventSubscription.All |
						EventSubscription.InputActiveStateChanged |
						EventSubscription.InputShowStateChanged |
						EventSubscription.InputVolumeMeters |
						EventSubscription.SceneItemTransformChanged,
					rpcVersion: 1,
				},
			)
			if (obsWebSocketVersion) {
				this.updateStatus(InstanceStatus.Ok)
				this.stopReconnectionPoll()
				this.log('info', 'Connected to OBS')

				//Setup Initial State Objects
				this.initializeStates()

				//Get Initial OBS Info
				let initialInfo = await this.obsInfo()

				if (initialInfo) {
					//Start Listeners
					this.obsListeners()

					//Get Project Info
					this.getStats()
					this.getRecordStatus()
					this.getStreamStatus()
					this.startStatsPoll()

					//Build General Parameters
					this.buildProfileList()
					this.buildSceneCollectionList()

					//Build Scene Collection Parameters
					this.buildSceneTransitionList()
					this.buildSpecialInputs()
					this.buildSceneList()
				} else {
					//throw an error if initial info returns false.
					throw new Error('could not get OBS info')
				}
			}
		} catch (error) {
			this.processWebsocketError(error)
		}
	}

	processWebsocketError(error) {
		if (!this.reconnectionPoll) {
			let tryReconnect = null
			if (error?.message.match(/(Server sent no subprotocol)/i)) {
				tryReconnect = false
				this.log('error', 'Failed to connect to OBS. Please upgrade OBS to version 28 or above')
				this.updateStatus(InstanceStatus.ConnectionFailure, 'Outdated OBS version')
			} else if (error?.message.match(/(missing an `authentication` string)/i)) {
				tryReconnect = false
				this.log(
					'error',
					`Failed to connect to OBS. Please enter your WebSocket Server password in the module settings`,
				)
				this.updateStatus(InstanceStatus.BadConfig, 'Missing password')
			} else if (error?.message.match(/(Authentication failed)/i)) {
				tryReconnect = false
				this.log(
					'error',
					`Failed to connect to OBS. Please ensure your WebSocket Server password is correct in the module settings`,
				)
				this.updateStatus(InstanceStatus.AuthenticationFailure)
			} else if (error?.message.match(/(ECONNREFUSED)/i)) {
				tryReconnect = true
				this.log('error', `Failed to connect to OBS. Please ensure OBS is open and reachable via your network`)
				this.updateStatus(InstanceStatus.ConnectionFailure)
			} else {
				tryReconnect = true
				this.log('error', `Failed to connect to OBS (${error.message})`)
				this.updateStatus(InstanceStatus.UnknownError)
			}
			if (tryReconnect) {
				this.startReconnectionPoll()
			}
		}
	}

	async disconnectOBS() {
		if (this.obs) {
			//Clear all active polls
			this.stopStatsPoll()
			this.stopMediaPoll()
			//Remove listeners, will recreate on connection
			this.obs.removeAllListeners()
			//Disconnect from OBS
			await this.obs.disconnect()
		}
	}

	connectionLost() {
		if (!this.reconnectionPoll) {
			this.log('error', 'Connection lost to OBS')
			this.updateStatus(InstanceStatus.Disconnected)
			this.disconnectOBS()

			this.startReconnectionPoll()
		}
	}

	//OBS Websocket Listeners
	async obsListeners() {
		//General
		this.obs.once('ExitStarted', () => {
			this.connectionLost()
		})
		this.obs.on('ConnectionClosed', () => {
			this.connectionLost()
		})
		this.obs.on('VendorEvent', (data) => {
			this.vendorEvent = data.eventData
			let eventData = data.eventData
			try {
				eventData = JSON.stringify(eventData)
			} catch (error) {
				this.log('debug', `Vendor Event Error: ${error}`)
			}
			this.setVariableValues({
				vendor_event_name: data.vendorName,
				vendor_event_type: data.eventType,
				vendor_event_data: eventData,
			})
			this.checkFeedbacks('vendorEvent')
		})
		//Config
		this.obs.on('CurrentSceneCollectionChanging', () => {
			this.stopMediaPoll()
			this.states.sceneCollectionChanging = true
		})
		this.obs.on('CurrentSceneCollectionChanged', (data) => {
			this.states.currentSceneCollection = data.sceneCollectionName
			this.checkFeedbacks('scene_collection_active')
			this.setVariableValues({ scene_collection: this.states.currentSceneCollection })
			this.states.sceneCollectionChanging = false
			this.resetSceneSourceStates()
			this.buildSceneList()
			this.buildSceneTransitionList()
			this.obsInfo()
		})
		this.obs.on('SceneCollectionListChanged', () => {
			this.buildSceneCollectionList()
		})
		this.obs.on('CurrentProfileChanging', () => {})
		this.obs.on('CurrentProfileChanged', (data) => {
			this.states.currentProfile = data.profileName
			this.checkFeedbacks('profile_active')
			this.setVariableValues({ profile: this.states.currentProfile })
			this.obsInfo()
		})
		this.obs.on('ProfileListChanged', () => {
			this.buildProfileList()
		})
		//Scenes
		this.obs.on('SceneCreated', (data) => {
			if (data?.isGroup === false && this.states.sceneCollectionChanging === false) {
				this.addScene(data.sceneName)
			}
		})
		this.obs.on('SceneRemoved', (data) => {
			if (data?.isGroup === false && this.states.sceneCollectionChanging === false) {
				this.removeScene(data.sceneName)
			}
		})
		this.obs.on('SceneNameChanged', (data) => {
			if (this.sceneItems[data.oldSceneName]) {
				this.sceneItems[data.sceneName] = this.sceneItems[data.oldSceneName]
				delete this.sceneItems[data.oldSceneName]
			}
			let scene = this.sceneChoices.findIndex((item) => item.id === data.oldSceneName)
			this.sceneChoices.splice(scene, 1)
			this.sceneChoices.push({ id: data.sceneName, label: data.sceneName })

			this.updateActionsFeedbacksVariables()
		})
		this.obs.on('CurrentProgramSceneChanged', (data) => {
			this.states.previousScene = this.states.programScene
			this.states.programScene = data.sceneName
			this.setVariableValues({ scene_active: this.states.programScene, scene_previous: this.states.previousScene })
			this.checkFeedbacks('scene_active', 'sceneProgram', 'scenePrevious')
		})
		this.obs.on('CurrentPreviewSceneChanged', (data) => {
			this.states.previewScene = data.sceneName ?? 'None'
			this.setVariableValues({ scene_preview: this.states.previewScene })
			this.checkFeedbacks('scene_active', 'scenePreview')
		})
		this.obs.on('SceneListChanged', (data) => {
			this.scenes = data.scenes
		})
		//Inputs
		this.obs.on('InputCreated', () => {})
		this.obs.on('InputRemoved', (data) => {
			let source = this.sourceChoices.findIndex((item) => item.id == data.inputName)
			if (source > -1) {
				this.sourceChoices.splice(source, 1)
			}
			delete this.sources[data.inputName]
			this.updateActionsFeedbacksVariables()
		})
		this.obs.on('InputNameChanged', () => {})
		this.obs.on('InputActiveStateChanged', (data) => {
			if (this.sources[data.inputName]) {
				this.sources[data.inputName].active = data.videoActive
				this.checkFeedbacks('scene_item_active')
			}
		})
		this.obs.on('InputShowStateChanged', (data) => {
			if (this.sources[data.inputName]) {
				this.sources[data.inputName].videoShowing = data.videoShowing
				this.checkFeedbacks('scene_item_previewed')
			}
		})
		this.obs.on('InputMuteStateChanged', (data) => {
			this.sources[data.inputName].inputMuted = data.inputMuted
			let name = this.sources[data.inputName].validName
			this.setVariableValues({
				[`mute_${name}`]: this.sources[data.inputName].inputMuted ? 'Muted' : 'Unmuted',
			})
			this.checkFeedbacks('audio_muted')
		})
		this.obs.on('InputVolumeChanged', (data) => {
			this.sources[data.inputName].inputVolume = this.roundNumber(data.inputVolumeDb, 1)
			let name = this.sources[data.inputName].validName
			this.setVariableValues({ [`volume_${name}`]: this.sources[data.inputName].inputVolume + 'db' })
			this.checkFeedbacks('volume')
		})
		this.obs.on('InputAudioBalanceChanged', (data) => {
			this.sources[data.inputName].inputAudioBalance = this.roundNumber(data.inputAudioBalance, 1)
			let name = this.sources[data.inputName].validName
			this.setVariableValues({ [`balance_${name}`]: this.sources[data.inputName].inputAudioBalance })
		})
		this.obs.on('InputAudioSyncOffsetChanged', (data) => {
			this.sources[data.inputName].inputAudioSyncOffset = data.inputAudioSyncOffset
			let name = this.sources[data.inputName].validName
			this.setVariableValues({
				[`sync_offset_${name}`]: this.sources[data.inputName].inputAudioSyncOffset + 'ms',
			})
		})
		this.obs.on('InputAudioTracksChanged', () => {})
		this.obs.on('InputAudioMonitorTypeChanged', (data) => {
			this.sources[data.inputName].monitorType = data.monitorType
			let name = this.sources[data.inputName].validName
			let monitorType
			if (data.monitorType === 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT') {
				monitorType = 'Monitor / Output'
			} else if (data.monitorType === 'OBS_MONITORING_TYPE_MONITOR_ONLY') {
				monitorType = 'Monitor Only'
			} else {
				monitorType = 'Off'
			}
			this.setVariableValues({ [`monitor_${name}`]: monitorType })
			this.checkFeedbacks('audio_monitor_type')
		})
		this.obs.on('InputVolumeMeters', (data) => {
			this.updateAudioPeak(data)
		})
		this.obs.on('InputSettingsChanged', (data) => {
			let source = data.inputName
			let settings = data.inputSettings

			this.updateInputSettings(source, settings)
		})
		//Transitions
		this.obs.on('CurrentSceneTransitionChanged', async (data) => {
			let transition = await this.sendRequest('GetCurrentSceneTransition')

			this.states.currentTransition = data.transitionName
			this.states.transitionDuration = transition?.transitionDuration ?? '0'

			this.checkFeedbacks('transition_duration', 'current_transition')
			this.setVariableValues({
				current_transition: this.states.currentTransition,
				transition_duration: this.states.transitionDuration,
			})
		})
		this.obs.on('CurrentSceneTransitionDurationChanged', (data) => {
			this.states.transitionDuration = data.transitionDuration ?? '0'
			this.checkFeedbacks('transition_duration')
			this.setVariableValues({ transition_duration: this.states.transitionDuration })
		})
		this.obs.on('SceneTransitionStarted', () => {
			this.states.transitionActive = true
			this.setVariableValues({ transition_active: 'True' })
			this.checkFeedbacks('transition_active')
		})
		this.obs.on('SceneTransitionEnded', () => {
			this.states.transitionActive = false
			this.setVariableValues({ transition_active: 'False' })
			this.checkFeedbacks('transition_active')
		})
		this.obs.on('SceneTransitionVideoEnded', () => {})
		//Filters
		this.obs.on('SourceFilterListReindexed', () => {})
		this.obs.on('SourceFilterCreated', (data) => {
			this.getSourceFilters(data.sourceName)
		})
		this.obs.on('SourceFilterRemoved', (data) => {
			this.getSourceFilters(data.sourceName)
		})
		this.obs.on('SourceFilterNameChanged', () => {})
		this.obs.on('SourceFilterEnableStateChanged', (data) => {
			if (this.sourceFilters[data.sourceName]) {
				let filter = this.sourceFilters[data.sourceName].findIndex((item) => item.filterName == data.filterName)
				if (filter !== undefined) {
					this.sourceFilters[data.sourceName][filter].filterEnabled = data.filterEnabled
					this.checkFeedbacks('filter_enabled')
				}
			}
		})
		//Scene Items
		this.obs.on('SceneItemCreated', (data) => {
			if (this.states.sceneCollectionChanging === false) {
				this.buildSourceList(data.sceneName)
			}
		})
		this.obs.on('SceneItemRemoved', (data) => {
			if (this.states.sceneCollectionChanging === false) {
				let item = this.sceneItems[data.sceneName].findIndex((item) => item.sceneItemId === data.sceneItemId)
				if (item > -1) {
					this.sceneItems[data.sceneName].splice(item, 1)
				}
			}
		})
		this.obs.on('SceneItemListReindexed', () => {})
		this.obs.on('SceneItemEnableStateChanged', (data) => {
			if (this.groups[data.sceneName]) {
				let sceneItem = this.groups[data.sceneName].findIndex((item) => item.sceneItemId === data.sceneItemId)
				this.groups[data.sceneName][sceneItem].sceneItemEnabled = data.sceneItemEnabled
			} else {
				let sceneItem = this.sceneItems[data.sceneName].findIndex((item) => item.sceneItemId === data.sceneItemId)
				this.sceneItems[data.sceneName][sceneItem].sceneItemEnabled = data.sceneItemEnabled
			}
			this.checkFeedbacks('scene_item_active_in_scene')
		})
		this.obs.on('SceneItemLockStateChanged', () => {})
		this.obs.on('SceneItemSelected', () => {})
		this.obs.on('SceneItemTransformChanged', () => {})
		//Outputs
		this.obs.on('StreamStateChanged', (data) => {
			this.states.streaming = data.outputActive

			this.setVariableValues({ streaming: this.states.streaming ? 'Live' : 'Off-Air' })
			this.checkFeedbacks('streaming', 'streamCongestion')
		})
		this.obs.on('RecordStateChanged', (data) => {
			if (data.outputActive === true) {
				this.states.recording = 'Recording'
			} else {
				if (data.outputState === 'OBS_WEBSOCKET_OUTPUT_PAUSED') {
					this.states.recording = 'Paused'
				} else {
					this.states.recording = 'Stopped'
					this.setVariableValues({ recording_timecode: '00:00:00' })
				}
			}
			if (data.outputPath) {
				this.setVariableValues({ recording_file_name: data.outputPath.match(/[^\\\/]+(?=\.[\w]+$)|[^\\\/]+$/) })
			}
			this.setVariableValues({ recording: this.states.recording })
			this.checkFeedbacks('recording')
		})
		this.obs.on('ReplayBufferStateChanged', (data) => {
			this.states.replayBuffer = data.outputActive
			this.checkFeedbacks('replayBufferActive')
		})
		this.obs.on('RecordFileChanged', (data) => {
			if (data.newOutputPath) {
				this.setVariableValues({ recording_file_name: data.newOutputPath.match(/[^\\\/]+(?=\.[\w]+$)|[^\\\/]+$/) })
			}
		})
		this.obs.on('VirtualcamStateChanged', (data) => {
			this.outputs['virtualcam_output'].outputActive = data.outputActive
			this.checkFeedbacks('output_active')
		})
		this.obs.on('ReplayBufferSaved', (data) => {
			this.setVariableValues({ replay_buffer_path: data.savedReplayPath })
		})
		//Media Inputs
		this.obs.on('MediaInputPlaybackStarted', (data) => {
			this.states.currentMedia = data.inputName

			let name = this.sources[data.inputName].validName
			this.setVariableValues({
				[`media_status_${name}`]: 'Playing',
			})
		})
		this.obs.on('MediaInputPlaybackEnded', (data) => {
			if (this.states.currentMedia == data.inputName) {
				let name = this.sources[data.inputName].validName
				this.setVariableValues({
					[`media_status_${name}`]: 'Stopped',
				})
			}
		})
		this.obs.on('MediaInputActionTriggered', (data) => {
			if (data.mediaAction == 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE') {
				let name = this.sources[data.inputName].validName
				this.setVariableValues({ [`media_status_${name}`]: 'Paused' })
			}
		})
		//UI
		this.obs.on('StudioModeStateChanged', async (data) => {
			this.states.studioMode = data.studioModeEnabled ? true : false
			this.checkFeedbacks('studioMode')

			if (this.states.studioMode) {
				let preview = await this.sendRequest('GetCurrentPreviewScene')
				this.states.previewScene = preview?.sceneName ?? 'None'
			} else {
				this.states.previewScene = 'None'
			}
			this.checkFeedbacks('studioMode', 'scenePreview')
			this.setVariableValues({ scene_preview: this.states.previewScene })
		})
	}

	//OBS Websocket Commands
	async sendRequest(requestType, requestData) {
		try {
			let data = await this.obs.call(requestType, requestData)
			return data
		} catch (error) {
			this.log('debug', `Request ${requestType ?? ''} failed (${error})`)
			return
		}
	}

	async sendCustomRequest(requestType, requestData) {
		try {
			let data = await this.obs.call(requestType, requestData)
			if (data) {
				this.log(
					'debug',
					`Custom Command Response: Request ${requestType ?? ''} replied with ${requestData ? `data ${JSON.stringify(data)}` : 'no data'}`,
				)
				this.setVariableValues({
					custom_command_type: requestType,
					custom_command_request: requestData ? JSON.stringify(requestData) : null,
					custom_command_response: JSON.stringify(data),
				})
			} else {
				this.setVariableValues({
					custom_command_type: requestType,
					custom_command_request: requestData ? JSON.stringify(requestData) : null,
					custom_command_response: null,
				})
			}
			return data
		} catch (error) {
			this.log(
				'warn',
				`Custom Command Failed: Request ${requestType ?? ''} with data ${requestData ? JSON.stringify(requestData) : 'none'} failed (${error})`,
			)
			return
		}
	}

	async sendBatch(batch) {
		try {
			let data = await this.obs.callBatch(batch)
			let errors = data.filter((request) => request.requestStatus.result === false)
			if (errors.length > 0) {
				let errorMessages = errors.map((error) => error.requestStatus.comment).join(' // ')
				this.log('debug', `Partial batch request failure (${errorMessages})`)
			}
			return data
		} catch (error) {
			this.log('debug', `Batch request failed (${error})`)
			return
		}
	}

	//Polls
	startReconnectionPoll() {
		this.stopReconnectionPoll()
		this.reconnectionPoll = setInterval(() => {
			this.connectOBS()
		}, 5000)
	}

	stopReconnectionPoll() {
		if (this.reconnectionPoll) {
			clearInterval(this.reconnectionPoll)
			delete this.reconnectionPoll
		}
	}

	startStatsPoll() {
		this.stopStatsPoll()
		if (this.obs) {
			this.statsPoll = setInterval(() => {
				this.getStats()
				if (this.states.streaming) {
					this.getStreamStatus()
				}
				if (this.states.recording === 'Recording') {
					this.getRecordStatus()
				}
				if (this.outputs) {
					for (let outputName in this.outputs) {
						this.getOutputStatus(outputName)
					}
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

	startMediaPoll() {
		this.stopMediaPoll()
		this.mediaPoll = setInterval(() => {
			this.getMediaStatus()
		}, 1000)
	}

	stopMediaPoll() {
		if (this.mediaPoll) {
			clearInterval(this.mediaPoll)
			this.mediaPoll = null
		}
	}

	//General OBS Project Info
	async obsInfo() {
		try {
			let version = await this.sendRequest('GetVersion')
			this.states.version = version
			this.log(
				'debug',
				`OBS Version: ${version.obsVersion} // OBS Websocket Version: ${version.obsWebSocketVersion} // Platform: ${version.platformDescription}`,
			)
			version.supportedImageFormats.forEach((format) => {
				this.imageFormats.push({ id: format, label: format })
			})

			let studioMode = await this.sendRequest('GetStudioModeEnabled')
			this.states.studioMode = studioMode.studioModeEnabled ? true : false

			this.buildHotkeyList()
			this.buildOutputList()
			this.buildMonitorList()
			this.getVideoSettings()
			this.getReplayBufferStatus()
			return true
		} catch (error) {
			this.log('debug', error)
			return false
		}
	}

	async buildHotkeyList() {
		let hotkeyList = await this.sendRequest('GetHotkeyList')
		hotkeyList?.hotkeys?.forEach((hotkey) => {
			this.hotkeyNames.push({ id: hotkey, label: hotkey })
		})
		this.updateActionsFeedbacksVariables()
	}

	async buildProfileList() {
		let profiles = await this.sendRequest('GetProfileList')
		this.profileChoices = []

		this.states.currentProfile = profiles?.currentProfileName

		profiles?.profiles.forEach((profile) => {
			this.profileChoices.push({ id: profile, label: profile })
		})

		this.checkFeedbacks('profile_active')
		this.setVariableValues({ profile: this.states.currentProfile })
		this.updateActionsFeedbacksVariables()
	}

	async buildSceneCollectionList() {
		let collections = await this.sendRequest('GetSceneCollectionList')
		this.sceneCollectionList = []

		this.states.currentSceneCollection = collections?.currentSceneCollectionName
		collections?.sceneCollections.forEach((sceneCollection) => {
			this.sceneCollectionList.push({ id: sceneCollection, label: sceneCollection })
		})

		this.checkFeedbacks('scene_collection_active')
		this.setVariableValues({ scene_collection: this.states.currentSceneCollection })

		this.updateActionsFeedbacksVariables()
	}

	async buildSpecialInputs() {
		let specialInputs = await this.sendRequest('GetSpecialInputs')
		if (specialInputs) {
			for (let x in specialInputs) {
				let input = specialInputs[x]

				if (input) {
					this.sources[input] = {
						sourceName: input,
						validName: this.validName(input),
					}

					if (!this.sourceChoices.find((item) => item.id === input)) {
						this.sourceChoices.push({ id: input, label: input })
					}
					this.getAudioSources(input)
				}
			}
		}
	}

	async buildOutputList() {
		this.outputs = {}
		this.outputList = []

		let outputData = await this.sendRequest('GetOutputList')

		if (outputData) {
			outputData.outputs?.forEach((output) => {
				let outputKind = output.outputKind
				if (outputKind === 'virtualcam_output') {
					this.outputList.push({ id: 'virtualcam_output', label: 'Virtual Camera' })
				} else if (
					outputKind != 'ffmpeg_muxer' &&
					outputKind != 'ffmpeg_output' &&
					outputKind != 'replay_buffer' &&
					outputKind != 'rtmp_output'
				) {
					//The above outputKinds are handled separately by other actions, so they are omitted
					this.outputList.push({ id: output.outputName, label: output.outputName })
				}
				this.getOutputStatus(output.outputName)
			})
			this.updateActionsFeedbacksVariables()
		}
	}

	async buildMonitorList() {
		let monitorList = await this.sendRequest('GetMonitorList')
		this.states.monitors = monitorList

		if (monitorList) {
			monitorList.monitors?.forEach((monitor) => {
				let monitorName = monitor.monitorName ?? `Display ${monitor.monitorIndex}`

				this.monitors.push({
					id: monitor.monitorIndex,
					label: `${monitorName} (${monitor.monitorWidth}x${monitor.monitorHeight})`,
				})
			})
		}
	}

	getStats() {
		this.obs
			.call('GetStats')
			.then((data) => {
				this.states.stats = data

				let freeSpaceMB = this.roundNumber(data.availableDiskSpace, 0)
				let freeSpace = freeSpaceMB
				if (freeSpace > 1000) {
					freeSpace = `${this.roundNumber(freeSpace / 1000, 0)} GB`
				} else {
					freeSpace = `${this.roundNumber(freeSpace, 0)} MB`
				}

				this.setVariableValues({
					fps: this.roundNumber(data.activeFps, 2),
					render_total_frames: data.renderTotalFrames,
					render_missed_frames: data.renderSkippedFrames,
					output_total_frames: data.outputTotalFrames,
					output_skipped_frames: data.outputSkippedFrames,
					average_frame_time: this.roundNumber(data.averageFrameRenderTime, 2),
					cpu_usage: `${this.roundNumber(data.cpuUsage, 2)}%`,
					memory_usage: `${this.roundNumber(data.memoryUsage, 0)} MB`,
					free_disk_space: freeSpace,
					free_disk_space_mb: freeSpaceMB,
				})
				this.checkFeedbacks('freeDiskSpaceRemaining')
			})
			.catch((error) => {
				if (error?.message.match(/(Not connected)/i)) {
					this.connectionLost()
				}
			})
	}

	async getVideoSettings() {
		let videoSettings = await this.sendRequest('GetVideoSettings')

		if (videoSettings) {
			this.states.resolution = `${videoSettings.baseWidth}x${videoSettings.baseHeight}`
			this.states.outputResolution = `${videoSettings.outputWidth}x${videoSettings.outputHeight}`
			this.states.framerate = `${this.roundNumber(videoSettings.fpsNumerator / videoSettings.fpsDenominator, 2)} fps`
			this.setVariableValues({
				base_resolution: this.states.resolution,
				output_resolution: this.states.outputResolution,
				target_framerate: this.states.framerate,
			})
		}
	}

	//Outputs, Streams, Recordings
	async getStreamStatus() {
		let streamStatus = await this.sendRequest('GetStreamStatus')
		let streamService = await this.sendRequest('GetStreamServiceSettings')

		if (streamStatus) {
			this.states.streaming = streamStatus.outputActive
			this.states.streamingTimecode = streamStatus.outputTimecode.match(/\d\d:\d\d:\d\d/i)
			this.states.streamCongestion = streamStatus.outputCongestion

			let kbits = 0
			if (streamStatus.outputBytes > this.states.outputBytes) {
				kbits = Math.round(((streamStatus.outputBytes - this.states.outputBytes) * 8) / 1000)
				this.states.outputBytes = streamStatus.outputBytes
			} else {
				this.states.outputBytes = streamStatus.outputBytes
			}

			this.checkFeedbacks('streaming', 'streamCongestion')
			this.setVariableValues({
				streaming: streamStatus.outputActive ? 'Live' : 'Off-Air',
				stream_timecode: this.states.streamingTimecode,
				output_skipped_frames: streamStatus.outputSkippedFrames,
				output_total_frames: streamStatus.outputTotalFrames,
				kbits_per_sec: kbits,
				stream_service: streamService?.streamServiceSettings?.service ?? 'Custom',
			})
		}
	}

	async getRecordStatus() {
		let recordStatus = await this.sendRequest('GetRecordStatus')
		let recordDirectory = await this.sendRequest('GetRecordDirectory')

		if (recordStatus) {
			if (recordStatus.outputActive === true) {
				this.states.recording = 'Recording'
			} else {
				this.states.recording = recordStatus.outputPaused ? 'Paused' : 'Stopped'
			}

			this.states.recordingTimecode = recordStatus.outputTimecode.match(/\d\d:\d\d:\d\d/i)
			this.states.recordDirectory = recordDirectory.recordDirectory

			this.checkFeedbacks('recording')
			this.setVariableValues({
				recording: this.states.recording,
				recording_timecode: this.states.recordingTimecode,
				recording_path: this.states.recordDirectory,
			})
		}
	}

	async getOutputStatus(outputName) {
		if (!this.states.sceneCollectionChanging) {
			let outputStatus = await this.sendRequest('GetOutputStatus', { outputName: outputName })
			this.outputs[outputName] = outputStatus
			this.checkFeedbacks('output_active')
		}
	}

	async getReplayBufferStatus() {
		let replayBuffer = await this.sendRequest('GetReplayBufferStatus')

		if (replayBuffer) {
			this.states.replayBuffer = replayBuffer.outputActive
			this.checkFeedbacks('replayBufferActive')
		}
	}

	//Scene Collection Specific Info
	async buildSceneList() {
		this.scenes = []
		this.sceneChoices = []

		let sceneList = await this.sendRequest('GetSceneList')

		if (sceneList) {
			this.scenes = sceneList.scenes
			this.states.previewScene = sceneList.currentPreviewSceneName ?? 'None'
			this.states.programScene = sceneList.currentProgramSceneName

			this.setVariableValues({
				scene_preview: this.states.previewScene,
				scene_active: this.states.programScene,
			})

			this.scenes.forEach((scene) => {
				let sceneName = scene.sceneName
				this.sceneChoices.push({ id: sceneName, label: sceneName })
				this.buildSourceList(sceneName)

				this.getSourceFilters(sceneName)
			})
			this.updateActionsFeedbacksVariables()
		}
	}

	async buildSourceList(sceneName) {
		let data = await this.sendRequest('GetSceneItemList', { sceneName: sceneName })

		if (data) {
			this.sceneItems[sceneName] = data.sceneItems

			let batch = []
			for (const sceneItem of data.sceneItems) {
				let sourceName = sceneItem.sourceName
				this.sources[sourceName] = sceneItem

				//Generate name that can be used as valid Variable IDs
				this.sources[sourceName].validName = this.validName(sceneItem.sourceName)

				if (!this.sourceChoices.find((item) => item.id === sourceName)) {
					this.sourceChoices.push({ id: sourceName, label: sourceName })
				}

				if (sceneItem.isGroup) {
					this.getGroupInfo(sourceName)
				}

				batch.push(
					{
						requestId: sourceName,
						requestType: 'GetSourceActive',
						requestData: { sourceName: sourceName },
					},
					{
						requestId: sourceName,
						requestType: 'GetSourceFilterList',
						requestData: { sourceName: sourceName },
					},
				)
				if (sceneItem.inputKind) {
					batch.push({
						requestId: sourceName,
						requestType: 'GetInputSettings',
						requestData: { inputName: sourceName },
					})
				}
				this.getAudioSources(sourceName)
			}

			let sourceBatch = await this.sendBatch(batch)

			if (sourceBatch) {
				for (const response of sourceBatch) {
					if (response.requestStatus.result) {
						let sourceName = response.requestId
						let type = response.requestType
						let data = response.responseData

						switch (type) {
							case 'GetSourceActive':
								this.sources[sourceName].active = data.videoActive
								this.sources[sourceName].videoShowing = data.videoShowing
								break
							case 'GetSourceFilterList':
								this.sourceFilters[sourceName] = data.filters
								if (data?.filters) {
									this.sourceFilters[sourceName] = data.filters
									data.filters.forEach((filter) => {
										if (!this.filterList.find((item) => item.id === filter.filterName)) {
											this.filterList.push({ id: filter.filterName, label: filter.filterName })
										}
									})
								}
								break
							case 'GetInputSettings':
								this.buildInputSettings(sourceName, data.inputKind, data.inputSettings)
								break
							default:
								break
						}
					}
				}
				this.checkFeedbacks('scene_item_active')
				this.updateActionsFeedbacksVariables()
			}
		}
	}

	async getGroupInfo(groupName) {
		let data = await this.sendRequest('GetGroupSceneItemList', { sceneName: groupName })
		if (data) {
			this.groups[groupName] = data.sceneItems
			data.sceneItems?.forEach(async (sceneItem) => {
				let sourceName = sceneItem.sourceName
				this.sources[sourceName] = sceneItem
				this.sources[sourceName].validName = this.validName(sourceName)

				//Flag that this source is part of a group
				this.sources[sourceName].groupedSource = true
				this.sources[sourceName].groupName = groupName

				if (!this.sourceChoices.find((item) => item.id === sourceName)) {
					this.sourceChoices.push({ id: sourceName, label: sourceName })
				}

				this.getSourceFilters(sourceName)
				this.getAudioSources(sourceName)

				if (sceneItem.inputKind) {
					let input = await this.sendRequest('GetInputSettings', { inputName: sourceName })

					if (input.inputSettings) {
						this.buildInputSettings(sourceName, sceneItem.inputKind, input.inputSettings)
						this.updateActionsFeedbacksVariables()
					}
				}
			})
			this.updateActionsFeedbacksVariables()
		}
	}

	async buildSceneTransitionList() {
		this.transitionList = []

		let sceneTransitionList = await this.sendRequest('GetSceneTransitionList')
		let currentTransition = await this.sendRequest('GetCurrentSceneTransition')

		if (sceneTransitionList) {
			sceneTransitionList.transitions?.forEach((transition) => {
				this.transitionList.push({ id: transition.transitionName, label: transition.transitionName })
			})

			this.states.currentTransition = currentTransition?.transitionName ?? 'None'
			this.states.transitionDuration = currentTransition?.transitionDuration ?? '0'

			this.checkFeedbacks('transition_duration', 'current_transition')
			this.setVariableValues({
				current_transition: this.states.currentTransition,
				transition_duration: this.states.transitionDuration,
				transition_active: 'False',
			})
		}
	}

	//Scene and Source Actions
	addScene(sceneName) {
		this.sceneChoices.push({ id: sceneName, label: sceneName })
		this.buildSourceList(sceneName)
		this.updateActionsFeedbacksVariables()
	}

	removeScene(sceneName) {
		let scene = this.sceneChoices.findIndex((item) => item.id === sceneName)
		if (scene) {
			this.sceneChoices.splice(scene, 1)
		}
		delete this.sceneItems[sceneName]
		this.updateActionsFeedbacksVariables()
	}

	//Source Info
	async getMediaStatus() {
		let batch = []
		for (const source of this.mediaSourceList) {
			let sourceName = source.id
			batch.push({
				requestId: sourceName,
				requestType: 'GetMediaInputStatus',
				requestData: { inputName: sourceName },
			})
		}

		let data = await this.sendBatch(batch)

		if (data) {
			let currentMedia = []
			for (const response of data) {
				if (response.requestStatus.result) {
					let sourceName = response.requestId
					let validName = this.sources[sourceName].validName ?? sourceName
					let data = response.responseData

					this.mediaSources[sourceName] = data

					let remaining = data?.mediaDuration - data?.mediaCursor
					if (remaining > 0) {
						remaining = this.formatTimecode(remaining)
					} else {
						remaining = '--:--:--'
					}

					this.mediaSources[sourceName].timeElapsed = this.formatTimecode(data.mediaCursor)
					this.mediaSources[sourceName].timeRemaining = remaining

					if (data?.mediaState) {
						switch (data?.mediaState) {
							case 'OBS_MEDIA_STATE_PLAYING':
								if (this.sources[sourceName]?.active == true) {
									currentMedia.push({
										name: sourceName,
										elapsed: this.mediaSources[sourceName].timeElapsed,
										remaining: this.mediaSources[sourceName].timeRemaining,
									})
								}
								this.setVariableValues({
									[`media_status_${validName}`]: 'Playing',
								})
								break
							case 'OBS_MEDIA_STATE_PAUSED':
								if (this.sources[sourceName]?.active == true) {
									currentMedia.push({
										name: sourceName,
										elapsed: this.mediaSources[sourceName].timeElapsed,
										remaining: this.mediaSources[sourceName].timeRemaining,
									})
								}
								this.setVariableValues({ [`media_status_${validName}`]: 'Paused' })
								break
							default:
								this.setVariableValues({ [`media_status_${validName}`]: 'Stopped' })
								break
						}
					}
					this.setVariableValues({
						[`media_time_elapsed_${validName}`]: this.mediaSources[sourceName].timeElapsed,
						[`media_time_remaining_${validName}`]: remaining,
					})
					this.checkFeedbacks('media_playing', 'media_source_time_remaining')
				}
			}
			if (currentMedia) {
				const names = currentMedia.map((value) => value.name)
				const elapsed = currentMedia.map((value) => value.elapsed)
				const remaining = currentMedia.map((value) => value.remaining)

				this.setVariableValues({
					current_media_name: names.length > 0 ? names.join('\n') : 'None',
					current_media_time_elapsed: elapsed.length > 0 ? elapsed.join('\n') : '--:--:--',
					current_media_time_remaining: remaining.length > 0 ? remaining.join('\n') : '--:--:--',
				})
			}
		}
	}

	buildInputSettings(sourceName, inputKind, inputSettings) {
		let name = this.sources[sourceName].validName ?? sourceName
		this.sources[sourceName].settings = inputSettings

		switch (inputKind) {
			case 'text_ft2_source_v2':
			case 'text_gdiplus_v2':
			case 'text_gdiplus_v3':
				//Exclude text sources that read from file, as there is no way to edit or read the text value
				if (inputSettings?.from_file || inputSettings?.read_from_file) {
					this.setVariableValues({
						[`current_text_${name}`]: `Text from file: ${inputSettings.text_file ?? inputSettings.file}`,
					})
				} else {
					if (!this.textSourceList.find((item) => item.id === sourceName)) {
						this.textSourceList.push({ id: sourceName, label: sourceName })
					}
					this.setVariableValues({
						[`current_text_${name}`]: inputSettings.text ?? '',
					})
				}
				break
			case 'ffmpeg_source':
			case 'vlc_source':
				if (!this.mediaSourceList.find((item) => item.id === sourceName)) {
					this.mediaSourceList.push({ id: sourceName, label: sourceName })
				}
				if (!this.mediaPoll) {
					this.startMediaPoll()
				}
				break
			case 'image_source':
				if (!this.imageSourceList.find((item) => item.id === sourceName)) {
					this.imageSourceList.push({ id: sourceName, label: sourceName })
				}
				break
			default:
				break
		}
	}

	updateInputSettings(sourceName, inputSettings) {
		if (this.sources[sourceName]) {
			this.sources[sourceName].settings = inputSettings
			let name = this.sources[sourceName].validName ?? sourceName
			let inputKind = this.sources[sourceName].inputKind

			switch (inputKind) {
				case 'text_ft2_source_v2':
				case 'text_gdiplus_v2':
				case 'text_gdiplus_v3':
					//Exclude text sources that read from file, as there is no way to edit or read the text value
					if (inputSettings?.from_file || inputSettings?.read_from_file) {
						this.setVariableValues({
							[`current_text_${name}`]: `Text from file: ${inputSettings.text_file ?? inputSettings.file}`,
						})
					} else if (inputSettings?.text) {
						this.setVariableValues({
							[`current_text_${name}`]: inputSettings.text ?? '',
						})
					}
					break
				case 'ffmpeg_source':
				case 'vlc_source':
					let file = ''
					if (inputSettings?.playlist) {
						file = inputSettings?.playlist[0]?.value?.match(/[^\\\/]+(?=\.[\w]+$)|[^\\\/]+$/)
						//Use first value in playlist until support for determining currently playing cue
					} else if (inputSettings?.local_file) {
						file = inputSettings?.local_file?.match(/[^\\\/]+(?=\.[\w]+$)|[^\\\/]+$/)
					}
					this.setVariableValues({ [`media_file_name_${name}`]: file })

					break
				case 'image_source':
					this.setVariableValues({
						[`image_file_name_${name}`]: inputSettings?.file
							? inputSettings?.file?.match(/[^\\\/]+(?=\.[\w]+$)|[^\\\/]+$/)
							: '',
					})
					break
				default:
					break
			}
		}
	}

	async getSourceFilters(sourceName) {
		let data = await this.sendRequest('GetSourceFilterList', { sourceName: sourceName })

		if (data?.filters) {
			this.sourceFilters[sourceName] = data.filters
			data.filters.forEach((filter) => {
				if (!this.filterList.find((item) => item.id === filter.filterName)) {
					this.filterList.push({ id: filter.filterName, label: filter.filterName })
					this.updateActionsFeedbacksVariables()
				}
			})
		}
	}

	//Audio Sources
	getAudioSources(sourceName) {
		this.obs
			.call('GetInputAudioTracks', { inputName: sourceName })
			.then((data) => {
				if (!this.audioSourceList.find((item) => item.id === sourceName)) {
					this.audioSourceList.push({ id: sourceName, label: sourceName })
					this.sources[sourceName].inputAudioTracks = data.inputAudioTracks
					this.getSourceAudio(sourceName)
					this.updateActionsFeedbacksVariables()
				}
			})
			.catch(() => {
				//Ignore, this source is not an audio source
			})
	}

	async getSourceAudio(sourceName) {
		let validName = this.validName(sourceName)

		let batch = [
			{
				requestId: sourceName,
				requestType: 'GetInputMute',
				requestData: { inputName: sourceName },
			},
			{
				requestId: sourceName,
				requestType: 'GetInputVolume',
				requestData: { inputName: sourceName },
			},
			{
				requestId: sourceName,
				requestType: 'GetInputAudioBalance',
				requestData: { inputName: sourceName },
			},
			{
				requestId: sourceName,
				requestType: 'GetInputAudioSyncOffset',
				requestData: { inputName: sourceName },
			},
			{
				requestId: sourceName,
				requestType: 'GetInputAudioMonitorType',
				requestData: { inputName: sourceName },
			},
			{
				requestId: sourceName,
				requestType: 'GetInputAudioTracks',
				requestData: { inputName: sourceName },
			},
		]

		let data = await this.sendBatch(batch)

		for (const response of data) {
			if (response.requestStatus.result && response.responseData) {
				let sourceName = response.requestId
				let type = response.requestType
				let data = response.responseData

				switch (type) {
					case 'GetInputMute':
						this.sources[sourceName].inputMuted = data.inputMuted
						break
					case 'GetInputVolume':
						this.sources[sourceName].inputVolume = this.roundNumber(data.inputVolumeDb, 1)
						break
					case 'GetInputAudioBalance':
						this.sources[sourceName].inputAudioBalance = this.roundNumber(data.inputAudioBalance, 1)
						break
					case 'GetInputAudioSyncOffset':
						this.sources[sourceName].inputAudioSyncOffset = data.inputAudioSyncOffset
						break
					case 'GetInputAudioMonitorType':
						this.sources[sourceName].monitorType = data.monitorType
						let monitorType
						if (data.monitorType === 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT') {
							monitorType = 'Monitor / Output'
						} else if (data.monitorType === 'OBS_MONITORING_TYPE_MONITOR_ONLY') {
							monitorType = 'Monitor Only'
						} else {
							monitorType = 'Off'
						}
						this.setVariableValues({ [`monitor_${validName}`]: monitorType })
						break
					case 'GetInputAudioTracks':
						this.sources[sourceName].inputAudioTracks = data.inputAudioTracks
						break
					default:
						break
				}
			}
		}

		this.setVariableValues({
			[`mute_${validName}`]: this.sources[sourceName].inputMuted ? 'Muted' : 'Unmuted',
			[`volume_${validName}`]: this.sources[sourceName].inputVolume + 'dB',
			[`balance_${validName}`]: this.sources[sourceName].inputAudioBalance,
			[`sync_offset_${validName}`]: this.sources[sourceName].inputAudioSyncOffset + 'ms',
		})
		this.checkFeedbacks('audio_muted', 'volume', 'audio_monitor_type')
	}

	updateAudioPeak(data) {
		this.audioPeak = {}
		data.inputs.forEach((input) => {
			let channel = input.inputLevelsMul[0]
			if (channel) {
				let channelPeak = channel?.[1]
				let dbPeak = Math.round(20.0 * Math.log10(channelPeak))
				if (this.audioPeak && dbPeak) {
					this.audioPeak[input.inputName] = dbPeak
					this.checkFeedbacks('audioPeaking', 'audioMeter')
				}
			}
		})
	}
}
runEntrypoint(OBSInstance, UpgradeScripts)
