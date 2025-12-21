import { InstanceBase, InstanceStatus, Regex, runEntrypoint, SomeCompanionConfigField } from '@companion-module/base'
import { getActions } from './actions.js'
import { getPresets } from './presets.js'
import { getVariables, updateVariableValues } from './variables.js'
import { getFeedbacks } from './feedbacks.js'
import UpgradeScripts from './upgrades.js'
import { ModuleConfig, Choice, OBSNormalizedState, OBSSource, OBSScene, OBSOutput } from './types.js'
import { OBSState } from './state.js'

import OBSWebSocket, { EventSubscription } from 'obs-websocket-js'

export class OBSInstance extends InstanceBase<ModuleConfig> {
	public obs!: OBSWebSocket
	public obsState!: OBSState
	public config!: ModuleConfig

	private reconnectionPoll?: NodeJS.Timeout
	private statsPoll?: NodeJS.Timeout
	private mediaPoll?: NodeJS.Timeout | null

	public get states(): OBSNormalizedState {
		return this.obsState.state
	}

	// Derived Choices
	public get sceneChoices(): Choice[] {
		return this.obsState.sceneChoices
	}
	public get sourceChoices(): Choice[] {
		return this.obsState.sourceChoices
	}
	public get audioSourceList(): Choice[] {
		return this.obsState.audioSourceList
	}
	public get mediaSourceList(): Choice[] {
		return this.obsState.mediaSourceList
	}
	public get filterList(): Choice[] {
		return this.obsState.filterList
	}
	public get transitionList(): Choice[] {
		return this.obsState.transitionList
	}
	public get profileChoices(): Choice[] {
		return this.obsState.profileChoices
	}
	public get sceneCollectionList(): Choice[] {
		return this.obsState.sceneCollectionList
	}
	public get outputList(): Choice[] {
		return this.obsState.outputList
	}
	public get textSourceList(): Choice[] {
		return this.obsState.textSourceList
	}
	public get imageSourceList(): Choice[] {
		return this.obsState.imageSourceList
	}

	// Choice Defaults
	public get sceneListDefault(): string {
		return this.obsState.sceneListDefault
	}
	public get sourceListDefault(): string {
		return this.obsState.sourceListDefault
	}
	public get audioSourceListDefault(): string {
		return this.obsState.audioSourceListDefault
	}
	public get filterListDefault(): string {
		return this.obsState.filterListDefault
	}
	public get profileChoicesDefault(): string {
		return this.obsState.profileChoicesDefault
	}

	// Special Choices
	public get sceneChoicesProgramPreview(): Choice[] {
		return this.obsState.sceneChoicesProgramPreview
	}
	public get sceneChoicesAnyScene(): Choice[] {
		return this.obsState.sceneChoicesAnyScene
	}
	public get sceneChoicesCustomScene(): Choice[] {
		return this.obsState.sceneChoicesCustomScene
	}
	public get sourceChoicesWithScenes(): Choice[] {
		return this.obsState.sourceChoicesWithScenes
	}
	public get mediaSourceListCurrentMedia(): Choice[] {
		return this.obsState.mediaSourceListCurrentMedia
	}

	// Legacy access for old parts of the code
	public get sources(): Map<string, OBSSource> {
		return this.obsState.state.sources
	}
	public get scenes(): Map<string, OBSScene> {
		return this.obsState.state.scenes
	}
	public get transitions(): Map<string, any> {
		return this.obsState.state.transitions
	}
	public get profiles(): Map<string, any> {
		return this.obsState.state.profiles
	}
	public get sceneCollections(): Map<string, any> {
		return this.obsState.state.sceneCollections
	}
	public get outputs(): Map<string, OBSOutput> {
		return this.obsState.state.outputs
	}
	public get sceneItems(): Map<string, any[]> {
		return this.obsState.state.sceneItems
	}
	public get groups(): Map<string, any[]> {
		return this.obsState.state.groups
	}
	public get inputKindList(): Map<string, any> {
		return this.obsState.state.inputKindList
	}
	public get mediaSources(): Map<string, any> {
		return this.obsState.state.mediaSources
	}
	public get imageSources(): Map<string, any> {
		return this.obsState.state.imageSources
	}
	public get textSources(): Map<string, any> {
		return this.obsState.state.textSources
	}
	public get sourceFilters(): Map<string, any[]> {
		return this.obsState.state.sourceFilters
	}
	public get audioPeak(): Map<string, number> {
		return this.obsState.state.audioPeak
	}
	public get hotkeyNames(): any[] {
		return this.obsState.state.hotkeyNames
	}
	public get imageFormats(): any[] {
		return this.obsState.state.imageFormats
	}
	public get monitors(): any[] {
		return this.obsState.state.monitors
	}
	public get vendorEvent(): any {
		return this.obsState.state.vendorEvent
	}
	constructor(internal: unknown) {
		super(internal)
	}

	//Companion Internal and Configuration
	async init(config: ModuleConfig): Promise<void> {
		this.updateStatus(InstanceStatus.Connecting)
		this.config = config
		this.obsState = new OBSState()

		if (this.config?.host && this.config?.port) {
			void this.connectOBS()
		} else if (this.config?.host && !this.config?.port) {
			this.updateStatus(InstanceStatus.BadConfig, 'Missing WebSocket Server port')
		} else if (!this.config?.host && this.config?.port) {
			this.updateStatus(InstanceStatus.BadConfig, 'Missing WebSocket Server IP address or hostname')
		} else {
			this.updateStatus(InstanceStatus.BadConfig, 'Missing WebSocket Server connection info')
		}
	}

	getConfigFields(): SomeCompanionConfigField[] {
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
				default: '4455',
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

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config
		void this.init(config)
	}

	async destroy(): Promise<void> {
		void this.disconnectOBS()
		void this.stopReconnectionPoll()
	}

	initVariables(): void {
		const variables = getVariables.bind(this)()
		this.setVariableDefinitions(variables)
		updateVariableValues.bind(this)()
	}

	initFeedbacks(): void {
		const feedbacks = getFeedbacks.bind(this)()
		this.setFeedbackDefinitions(feedbacks)
	}

	initPresets(): void {
		const presets = getPresets.bind(this)()
		this.setPresetDefinitions(presets)
	}

	initActions(): void {
		const actions = getActions.bind(this)()
		this.setActionDefinitions(actions)
	}

	//Utilities
	validName(name: string): string {
		//Generate a valid name for use as a variable ID
		try {
			return name.replace(/[^a-z0-9-_.]+/gi, '_')
		} catch (error) {
			this.log('debug', `Unable to generate validName for ${name}: ${error} `)
			return name
		}
	}

	formatTimecode(data: number): string {
		//Converts milliseconds into a readable time format (hh:mm:ss)
		try {
			const formattedTime = new Date(data).toISOString().slice(11, 19)
			return formattedTime
		} catch (error) {
			this.log('debug', `Error formatting timecode: ${error} `)
			return '00:00:00'
		}
	}

	roundNumber(number: number, decimalPlaces: number): number {
		//Rounds a number to a specified number of decimal places
		try {
			return Number(Math.round(Number(number + 'e' + (decimalPlaces ?? 0))) + 'e-' + (decimalPlaces ?? 0))
		} catch (error) {
			this.log('debug', `Error rounding number ${number}: ${error} `)
			return typeof number === 'number' ? number : 0
		}
	}

	rgbaToObsColor(rgbaString: string): number {
		// OBS expects colors as 32-bit integers: (alpha << 24) | (blue << 16) | (green << 8) | red
		// Parse rgba(r, g, b, a) format
		const match = rgbaString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
		if (!match) {
			// If not in expected format, try to parse as integer or return 0
			const parsed = parseInt(rgbaString, 10)
			return isNaN(parsed) ? 0 : parsed
		}

		const r = parseInt(match[1], 10)
		const g = parseInt(match[2], 10)
		const b = parseInt(match[3], 10)
		const a = match[4] ? Math.round(parseFloat(match[4]) * 255) : 255

		return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0
	}

	organizeChoices(): void {
		// Choices are now derived via getters in OBSState
	}

	async updateActionsFeedbacksVariables(): Promise<void> {
		this.organizeChoices()

		this.initActions()
		this.initVariables()
		this.initFeedbacks()
		this.initPresets()
		this.checkFeedbacks()
	}

	initializeStates(): void {
		this.obsState.resetSceneSourceStates()
		// Basic Info
		this.states.sceneCollectionChanging = false
	}

	//OBS Websocket Connection
	async connectOBS(): Promise<void> {
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
				void this.stopReconnectionPoll()
				this.log('info', 'Connected to OBS')

				//Setup Initial State Objects
				this.initializeStates()

				//Get Initial OBS Info
				const initialInfo = await this.obsInfo()

				if (initialInfo) {
					//Start Listeners
					await this.obsListeners()

					//Get Project Info
					await this.getStats()
					await this.getRecordStatus()
					await this.getStreamStatus()
					await this.startStatsPoll()

					//Build General Parameters
					await this.buildProfileList()
					await this.buildSceneCollectionList()

					//Build Scene Collection Parameters
					await this.buildSceneTransitionList()
					await this.buildSpecialInputs()
					await this.buildSceneList()
				} else {
					//throw an error if initial info returns false.
					throw new Error('could not get OBS info')
				}
			}
		} catch (error) {
			this.processWebsocketError(error)
		}
	}

	processWebsocketError(error: unknown): void {
		if (!this.reconnectionPoll) {
			let tryReconnect = null
			const errorMessage = error instanceof Error ? error.message : String(error)
			if (errorMessage.match(/(Server sent no subprotocol)/i)) {
				tryReconnect = false
				this.log('error', 'Failed to connect to OBS. Please upgrade OBS to version 28 or above')
				this.updateStatus(InstanceStatus.ConnectionFailure, 'Outdated OBS version')
			} else if (errorMessage.match(/(missing an `authentication` string)/i)) {
				tryReconnect = false
				this.log(
					'error',
					`Failed to connect to OBS. Please enter your WebSocket Server password in the module settings`,
				)
				this.updateStatus(InstanceStatus.BadConfig, 'Missing password')
			} else if (errorMessage.match(/(Authentication failed)/i)) {
				tryReconnect = false
				this.log(
					'error',
					`Failed to connect to OBS. Please ensure your WebSocket Server password is correct in the module settings`,
				)
				this.updateStatus(InstanceStatus.AuthenticationFailure)
			} else if (errorMessage.match(/(ECONNREFUSED)/i)) {
				tryReconnect = true
				this.log('error', `Failed to connect to OBS. Please ensure OBS is open and reachable via your network`)
				this.updateStatus(InstanceStatus.ConnectionFailure)
			} else {
				tryReconnect = true
				this.log('error', `Failed to connect to OBS (${errorMessage})`)
				this.updateStatus(InstanceStatus.UnknownError)
			}
			if (tryReconnect) {
				void this.startReconnectionPoll()
			}
		}
	}

	async disconnectOBS(): Promise<void> {
		if (this.obs) {
			//Clear all active polls
			void this.stopStatsPoll()
			void this.stopMediaPoll()
			//Remove listeners, will recreate on connection
			this.obs.removeAllListeners()
			//Disconnect from OBS
			await this.obs.disconnect()
		}
	}

	async connectionLost(): Promise<void> {
		if (!this.reconnectionPoll) {
			this.log('error', 'Connection lost to OBS')
			this.updateStatus(InstanceStatus.Disconnected)
			await this.disconnectOBS()

			void this.startReconnectionPoll()
		}
	}

	//OBS Websocket Listeners
	async obsListeners(): Promise<void> {
		//General
		this.obs.once('ExitStarted', () => {
			void this.connectionLost()
		})
		this.obs.on('ConnectionClosed', () => {
			void this.connectionLost()
		})
		this.obs.on('VendorEvent', (data) => {
			this.states.vendorEvent = data
			let eventData = ''
			try {
				eventData = JSON.stringify(data.eventData)
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
			void this.stopMediaPoll()
			this.states.sceneCollectionChanging = true
		})
		this.obs.on('CurrentSceneCollectionChanged', (data) => {
			this.states.currentSceneCollection = data.sceneCollectionName
			void this.checkFeedbacks('scene_collection_active')
			this.setVariableValues({ scene_collection: this.states.currentSceneCollection })
			this.states.sceneCollectionChanging = false
			this.obsState.resetSceneSourceStates()
			void this.buildSceneList()
			void this.buildSceneTransitionList()
			void this.obsInfo()
		})
		this.obs.on('SceneCollectionListChanged', () => {
			void this.buildSceneCollectionList()
		})
		this.obs.on('CurrentProfileChanging', () => {})
		this.obs.on('CurrentProfileChanged', (data) => {
			this.states.currentProfile = data.profileName
			void this.checkFeedbacks('profile_active')
			this.setVariableValues({ profile: this.states.currentProfile })
			void this.obsInfo()
		})
		this.obs.on('ProfileListChanged', () => {
			void this.buildProfileList()
		})
		//Scenes
		this.obs.on('SceneCreated', (data) => {
			if (data?.isGroup === false && this.states.sceneCollectionChanging === false) {
				void this.addScene(data.sceneName)
			}
		})
		this.obs.on('SceneRemoved', (data) => {
			if (data?.isGroup === false && this.states.sceneCollectionChanging === false) {
				void this.removeScene(data.sceneName)
			}
		})
		this.obs.on('SceneNameChanged', (data) => {
			const sceneItems = this.states.sceneItems.get(data.oldSceneName)
			if (sceneItems) {
				this.states.sceneItems.set(data.sceneName, sceneItems)
				this.states.sceneItems.delete(data.oldSceneName)
			}
			void this.updateActionsFeedbacksVariables()
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
			this.states.scenes.clear()
			for (const scene of data.scenes as any[]) {
				this.states.scenes.set(scene.sceneName, scene)
			}
		})
		//Inputs
		this.obs.on('InputCreated', () => {})
		this.obs.on('InputRemoved', (data) => {
			this.states.sources.delete(data.inputName)
			void this.updateActionsFeedbacksVariables()
		})
		this.obs.on('InputNameChanged', () => {})
		this.obs.on('InputActiveStateChanged', (data) => {
			const source = this.states.sources.get(data.inputName)
			if (source) {
				source.active = data.videoActive
				this.checkFeedbacks('scene_item_active')
			}
		})
		this.obs.on('InputShowStateChanged', (data) => {
			const source = this.states.sources.get(data.inputName)
			if (source) {
				source.videoShowing = data.videoShowing
				this.checkFeedbacks('scene_item_previewed')
			}
		})
		this.obs.on('InputMuteStateChanged', (data) => {
			const source = this.states.sources.get(data.inputName)
			if (source) {
				source.inputMuted = data.inputMuted
				const name = source.validName ?? data.inputName
				this.setVariableValues({
					[`mute_${name}`]: source.inputMuted ? 'Muted' : 'Unmuted',
				})
				this.checkFeedbacks('audio_muted')
			}
		})
		this.obs.on('InputVolumeChanged', (data) => {
			const source = this.states.sources.get(data.inputName)
			if (source) {
				source.inputVolume = this.roundNumber(data.inputVolumeDb, 1)
				const name = source.validName ?? data.inputName
				this.setVariableValues({ [`volume_${name}`]: source.inputVolume + 'db' })
				this.checkFeedbacks('volume')
			}
		})
		this.obs.on('InputAudioBalanceChanged', (data) => {
			const source = this.states.sources.get(data.inputName)
			if (source) {
				source.inputAudioBalance = this.roundNumber(data.inputAudioBalance, 1)
				const name = source.validName ?? data.inputName
				this.setVariableValues({ [`balance_${name}`]: source.inputAudioBalance })
			}
		})
		this.obs.on('InputAudioSyncOffsetChanged', (data) => {
			const source = this.states.sources.get(data.inputName)
			if (source) {
				source.inputAudioSyncOffset = data.inputAudioSyncOffset
				const name = source.validName ?? data.inputName
				this.setVariableValues({
					[`sync_offset_${name}`]: source.inputAudioSyncOffset + 'ms',
				})
			}
		})
		this.obs.on('InputAudioTracksChanged', () => {})
		this.obs.on('InputAudioMonitorTypeChanged', (data) => {
			const source = this.states.sources.get(data.inputName)
			if (source) {
				source.monitorType = data.monitorType
				const name = source.validName ?? data.inputName
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
			}
		})
		this.obs.on('InputVolumeMeters', (data) => {
			this.updateAudioPeak(data)
		})
		this.obs.on('InputSettingsChanged', (data) => {
			const source = data.inputName
			const settings = data.inputSettings

			this.updateInputSettings(source, settings)
		})
		//Transitions
		this.obs.on('CurrentSceneTransitionChanged', (data) => {
			void (async () => {
				const transition = await this.sendRequest('GetCurrentSceneTransition')

				this.states.currentTransition = data.transitionName
				this.states.transitionDuration = transition?.transitionDuration ?? '0'

				this.checkFeedbacks('transition_duration', 'current_transition')
				this.setVariableValues({
					current_transition: this.states.currentTransition,
					transition_duration: this.states.transitionDuration,
				})

				if (!this.transitionList?.find((item) => item.id === data.transitionName)) {
					void this.buildSceneTransitionList()
					void this.updateActionsFeedbacksVariables()
				}
			})()
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
			void this.getSourceFilters(data.sourceName)
		})
		this.obs.on('SourceFilterRemoved', (data) => {
			void this.getSourceFilters(data.sourceName)
		})
		this.obs.on('SourceFilterNameChanged', () => {})
		this.obs.on('SourceFilterEnableStateChanged', (data) => {
			const sourceFilters = this.states.sourceFilters.get(data.sourceName)
			if (sourceFilters) {
				const filter = sourceFilters.find((item) => item.filterName == data.filterName)
				if (filter) {
					filter.filterEnabled = data.filterEnabled
					this.checkFeedbacks('filter_enabled')
				}
			}
		})
		//Scene Items
		this.obs.on('SceneItemCreated', (data) => {
			if (this.states.sceneCollectionChanging === false) {
				void this.buildSourceList(data.sceneName)
			}
		})
		this.obs.on('SceneItemRemoved', (data) => {
			if (this.states.sceneCollectionChanging === false) {
				const sceneItems = this.states.sceneItems.get(data.sceneName)
				if (sceneItems) {
					const itemIndex = sceneItems.findIndex((item) => item.sceneItemId === data.sceneItemId)
					if (itemIndex > -1) {
						sceneItems.splice(itemIndex, 1)
					}
				}
				const groups = this.states.groups.get(data.sceneName)
				if (groups) {
					const itemIndex = groups.findIndex((item) => item.sceneItemId === data.sceneItemId)
					if (itemIndex > -1) {
						groups.splice(itemIndex, 1)
					}
				}
			}
		})
		this.obs.on('SceneItemListReindexed', () => {})
		this.obs.on('SceneItemEnableStateChanged', (data) => {
			const groups = this.states.groups.get(data.sceneName)
			const sceneItems = this.states.sceneItems.get(data.sceneName)
			if (groups) {
				const sceneItem = groups.find((item) => item.sceneItemId === data.sceneItemId)
				if (sceneItem) {
					sceneItem.sceneItemEnabled = data.sceneItemEnabled
				}
			} else if (sceneItems) {
				const sceneItem = sceneItems.find((item) => item.sceneItemId === data.sceneItemId)
				if (sceneItem) {
					sceneItem.sceneItemEnabled = data.sceneItemEnabled
				}
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
			if (this.states.streaming === false) {
				this.setVariableValues({
					stream_timecode: '00:00:00',
					stream_timecode_hh: '00',
					stream_timecode_mm: '00',
					stream_timecode_ss: '00',
				})
			}
		})
		this.obs.on('RecordStateChanged', (data) => {
			if (data.outputActive === true) {
				this.states.recording = 'Recording '
			} else {
				if (data.outputState === 'OBS_WEBSOCKET_OUTPUT_PAUSED') {
					this.states.recording = 'Paused'
				} else {
					this.states.recording = 'Stopped'
					this.setVariableValues({
						recording_timecode: '00:00:00',
						recording_timecode_hh: '00',
						recording_timecode_mm: '00',
						recording_timecode_ss: '00',
					})
				}
			}
			if (data.outputPath) {
				this.setVariableValues({
					recording_file_name: data.outputPath.match(/[^\\/]+(?=\.[\w]+$)|[^\\/]+$/)?.[0] ?? '',
				})
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
				this.setVariableValues({
					recording_file_name: data.newOutputPath.match(/[^\\/]+(?=\.[\w]+$)|[^\\/]+$/)?.[0] ?? '',
				})
			}
		})
		this.obs.on('VirtualcamStateChanged', (data) => {
			const virtualCam = this.states.outputs.get('virtualcam_output')
			if (virtualCam) {
				virtualCam.outputActive = data.outputActive
				this.checkFeedbacks('output_active')
			}
		})
		this.obs.on('ReplayBufferSaved', (data) => {
			this.setVariableValues({ replay_buffer_path: data.savedReplayPath })
		})
		//Media Inputs
		this.obs.on('MediaInputPlaybackStarted', (data) => {
			this.states.currentMedia = data.inputName

			const source = this.states.sources.get(data.inputName)
			const name = source?.validName ?? data.inputName
			this.setVariableValues({
				[`media_status_${name}`]: 'Playing',
			})
		})
		this.obs.on('MediaInputPlaybackEnded', (data) => {
			if (this.states.currentMedia == data.inputName) {
				const source = this.states.sources.get(data.inputName)
				const name = source?.validName ?? data.inputName
				this.setVariableValues({
					[`media_status_${name}`]: 'Stopped',
				})
			}
		})
		this.obs.on('MediaInputActionTriggered', (data) => {
			if (data.mediaAction == 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE') {
				const source = this.states.sources.get(data.inputName)
				const name = source?.validName ?? data.inputName
				this.setVariableValues({ [`media_status_${name}`]: 'Paused' })
			}
		})
		//UI
		this.obs.on('StudioModeStateChanged', (data) => {
			void (async () => {
				this.states.studioMode = data.studioModeEnabled ? true : false
				this.checkFeedbacks('studioMode')

				if (this.states.studioMode) {
					const preview = await this.sendRequest('GetCurrentPreviewScene')
					this.states.previewScene = preview?.sceneName ?? 'None'
				} else {
					this.states.previewScene = 'None'
				}
				this.checkFeedbacks('studioMode', 'scenePreview')
				this.setVariableValues({ scene_preview: this.states.previewScene })
			})()
		})
	}

	//OBS Websocket Commands
	async sendRequest(requestType: string, requestData?: unknown): Promise<any> {
		try {
			const data = await this.obs.call(requestType as any, requestData)
			return data
		} catch (error) {
			this.log('debug', `Request ${requestType ?? ''} failed (${error})`)
			return
		}
	}

	async sendCustomRequest(requestType: string, requestData?: unknown): Promise<any> {
		try {
			const data = await this.obs.call(requestType as any, requestData)
			if (data) {
				this.log(
					'debug',
					`Custom Command Response: Request ${requestType ?? ''} replied with ${requestData ? `data ${JSON.stringify(data)}` : 'no data'}`,
				)
				this.setVariableValues({
					custom_command_type: requestType,
					custom_command_request: requestData ? JSON.stringify(requestData) : '',
					custom_command_response: JSON.stringify(data),
				})
			} else {
				this.states.custom_command_request = ''
				this.states.custom_command_response = ''
				this.setVariableValues({
					custom_command_request: '',
					custom_command_response: '',
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

	async sendBatch(batch: any[]): Promise<any> {
		try {
			const data = await this.obs.callBatch(batch)
			const errors = data.filter((request: any) => request.requestStatus.result === false)
			if (errors.length > 0) {
				const errorMessages = errors.map((error: any) => error.requestStatus.comment).join(' // ')
				this.log('debug', `Partial batch request failure (${errorMessages})`)
			}
			return data
		} catch (error) {
			this.log('debug', `Request GetStats failed (${error as any})`)
			return
		}
	}

	//Polls
	async startReconnectionPoll(): Promise<void> {
		void this.stopReconnectionPoll()
		this.reconnectionPoll = setInterval(() => {
			void this.connectOBS()
		}, 5000)
	}

	async stopReconnectionPoll(): Promise<void> {
		if (this.reconnectionPoll) {
			clearInterval(this.reconnectionPoll)
			delete this.reconnectionPoll
		}
	}

	async startStatsPoll(): Promise<void> {
		void this.stopStatsPoll()
		if (this.obs) {
			this.statsPoll = setInterval(() => {
				void this.getStats()
				if (this.states.streaming) {
					void this.getStreamStatus()
				}
				if (this.states.recording === 'Recording') {
					void this.getRecordStatus()
				}
				if (this.outputs) {
					for (const outputName in this.outputs) {
						void this.getOutputStatus(outputName)
					}
				}
			}, 1000)
		}
	}

	async stopStatsPoll(): Promise<void> {
		if (this.statsPoll) {
			clearInterval(this.statsPoll)
			delete this.statsPoll
		}
	}

	async startMediaPoll(): Promise<void> {
		void this.stopMediaPoll()
		this.mediaPoll = setInterval(() => {
			void this.getMediaStatus()
		}, 1000)
	}

	async stopMediaPoll(): Promise<void> {
		if (this.mediaPoll) {
			clearInterval(this.mediaPoll)
			this.mediaPoll = null
		}
	}

	//General OBS Project Info
	async obsInfo(): Promise<boolean> {
		try {
			const version = await this.sendRequest('GetVersion')
			this.states.version = version
			this.log(
				'debug',
				`OBS Version: ${version.obsVersion} // OBS Websocket Version: ${version.obsWebSocketVersion} // Platform: ${version.platformDescription}`,
			)
			this.states.imageFormats = []
			version.supportedImageFormats.forEach((format: string) => {
				this.imageFormats.push({ id: format, label: format })
			})

			const studioMode = await this.sendRequest('GetStudioModeEnabled')
			this.states.studioMode = studioMode.studioModeEnabled ? true : false

			await this.buildHotkeyList()
			await this.buildOutputList()
			await this.buildMonitorList()
			await this.getVideoSettings()
			await this.getReplayBufferStatus()
			await this.getInputKindList()

			return true
		} catch (error) {
			this.log('debug', error as any)
			return false
		}
	}

	async buildHotkeyList(): Promise<void> {
		const hotkeyList = await this.sendRequest('GetHotkeyList')
		this.states.hotkeyNames = []
		hotkeyList?.hotkeys?.forEach((hotkey: any) => {
			this.hotkeyNames.push({ id: hotkey, label: hotkey })
		})
		void this.updateActionsFeedbacksVariables()
	}

	async getInputKindList(): Promise<void> {
		const inputKindList = await this.sendRequest('GetInputKindList')
		await Promise.all(
			inputKindList?.inputKinds?.map(async (inputKind: any) => {
				this.states.inputKindList.set(inputKind, {})
				const defaultSettings = await this.sendRequest('GetInputDefaultSettings', { inputKind: inputKind })
				this.states.inputKindList.set(inputKind, defaultSettings)
			}) ?? [],
		)
	}

	async buildProfileList(): Promise<void> {
		const profiles = await this.sendRequest('GetProfileList')
		this.states.profiles.clear()

		this.states.currentProfile = profiles?.currentProfileName

		profiles?.profiles.forEach((profile: any) => {
			this.states.profiles.set(profile, {})
		})

		this.checkFeedbacks('profile_active')
		this.setVariableValues({ profile: this.states.currentProfile })
		void this.updateActionsFeedbacksVariables()
	}

	async buildSceneCollectionList(): Promise<void> {
		const collections = await this.sendRequest('GetSceneCollectionList')
		this.states.sceneCollections.clear()

		this.states.currentSceneCollection = collections?.currentSceneCollectionName
		collections?.sceneCollections.forEach((sceneCollection: any) => {
			this.states.sceneCollections.set(sceneCollection, {})
		})

		this.checkFeedbacks('scene_collection_active')
		this.setVariableValues({ scene_collection: this.states.currentSceneCollection })

		void this.updateActionsFeedbacksVariables()
	}

	async buildSpecialInputs(): Promise<void> {
		const specialInputs = await this.sendRequest('GetSpecialInputs')
		if (specialInputs) {
			await Promise.all(
				Object.values(specialInputs).map(async (input) => {
					if (input) {
						const inputName = input as string
						this.states.sources.set(inputName, {
							sourceName: inputName,
							validName: this.validName(inputName),
						})

						await this.getAudioSources(inputName)
					}
				}),
			)
		}
	}

	async buildOutputList(): Promise<void> {
		this.states.outputs.clear()

		const outputData = await this.sendRequest('GetOutputList')

		if (outputData) {
			outputData.outputs?.forEach((output: any) => {
				this.states.outputs.set(output.outputName, output)

				void this.getOutputStatus(output.outputName)
			})
			void this.updateActionsFeedbacksVariables()
		}
	}

	async buildMonitorList(): Promise<void> {
		const monitorList = await this.sendRequest('GetMonitorList')

		if (monitorList && Array.isArray(monitorList.monitors)) {
			this.states.monitors = monitorList.monitors.map((monitor: any) => {
				const monitorName = monitor.monitorName ?? `Display ${monitor.monitorIndex}`

				return {
					id: monitor.monitorIndex,
					label: `${monitorName} (${monitor.monitorWidth}x${monitor.monitorHeight})`,
				}
			})
		}
	}

	async getStats(): Promise<void> {
		this.obs
			.call('GetStats')
			.then((data) => {
				this.states.stats = data

				const freeSpaceMB = this.roundNumber(data.availableDiskSpace, 0)
				let freeSpace: number | string = freeSpaceMB
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
					void this.connectionLost()
				}
			})
	}

	async getVideoSettings(): Promise<void> {
		const videoSettings = await this.sendRequest('GetVideoSettings')

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
	async getStreamStatus(): Promise<void> {
		const streamStatus = await this.sendRequest('GetStreamStatus')
		const streamService = await this.sendRequest('GetStreamServiceSettings')

		if (streamStatus) {
			this.states.streaming = streamStatus.outputActive
			this.states.streamingTimecode = streamStatus.outputTimecode.match(/\d\d:\d\d:\d\d/i)

			const timecode = streamStatus.outputTimecode.match(/\d\d:\d\d:\d\d/i)
			this.states.streamingTimecode = timecode
			const streamingTimecodeSplit = String(timecode)?.split(':')

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
				stream_timecode_hh: streamingTimecodeSplit[0],
				stream_timecode_mm: streamingTimecodeSplit[1],
				stream_timecode_ss: streamingTimecodeSplit[2],
				output_skipped_frames: streamStatus.outputSkippedFrames,
				output_total_frames: streamStatus.outputTotalFrames,
				kbits_per_sec: kbits,
				stream_service: streamService?.streamServiceSettings?.service ?? 'Custom',
			})
		}
	}

	async getRecordStatus(): Promise<void> {
		const recordStatus = await this.sendRequest('GetRecordStatus')
		const recordDirectory = await this.sendRequest('GetRecordDirectory')

		if (recordStatus) {
			if (recordStatus.outputActive === true) {
				this.states.recording = 'Recording'
			} else {
				this.states.recording = recordStatus.outputPaused ? 'Paused' : 'Stopped'
			}

			const timecode = recordStatus.outputTimecode.match(/\d\d:\d\d:\d\d/i)
			this.states.recordingTimecode = timecode
			const recordingTimecodeSplit = String(timecode)?.split(':')
			this.states.recordDirectory = recordDirectory.recordDirectory

			this.checkFeedbacks('recording')
			this.setVariableValues({
				recording: this.states.recording,
				recording_timecode: this.states.recordingTimecode,
				recording_timecode_hh: recordingTimecodeSplit[0],
				recording_timecode_mm: recordingTimecodeSplit[1],
				recording_timecode_ss: recordingTimecodeSplit[2],
				recording_path: this.states.recordDirectory,
			})
		}
	}

	async getOutputStatus(outputName: string): Promise<void> {
		if (!this.states.sceneCollectionChanging) {
			const outputStatus = await this.sendRequest('GetOutputStatus', { outputName: outputName })
			this.states.outputs.set(outputName, outputStatus)
			this.checkFeedbacks('output_active')
		}
	}

	async getReplayBufferStatus(): Promise<void> {
		const replayBuffer = await this.sendRequest('GetReplayBufferStatus')

		if (replayBuffer) {
			this.states.replayBuffer = replayBuffer.outputActive
			this.checkFeedbacks('replayBufferActive')
		}
	}

	//Scene Collection Specific Info
	async buildSceneList(): Promise<void> {
		this.states.scenes.clear()

		const sceneList = await this.sendRequest('GetSceneList')

		if (sceneList) {
			if (Array.isArray(sceneList.scenes)) {
				for (const scene of sceneList.scenes) {
					this.states.scenes.set(scene.sceneName, scene)
				}
			}
			this.states.previewScene = sceneList.currentPreviewSceneName ?? 'None'
			this.states.programScene = sceneList.currentProgramSceneName

			this.setVariableValues({
				scene_preview: this.states.previewScene,
				scene_active: this.states.programScene,
			})

			await Promise.all(
				Array.from(this.states.scenes.values()).map(async (scene: any) => {
					const sceneName = scene.sceneName
					await this.buildSourceList(sceneName)

					await this.getSourceFilters(sceneName)
				}),
			)
			void this.updateActionsFeedbacksVariables()
		}
	}

	async buildSourceList(sceneName: string): Promise<void> {
		const data = await this.sendRequest('GetSceneItemList', { sceneName: sceneName })

		if (data) {
			this.states.sceneItems.set(sceneName, data.sceneItems)

			const batch = []
			for (const sceneItem of data.sceneItems as any[]) {
				const sourceName = sceneItem.sourceName
				if (!this.states.sources.has(sourceName)) {
					this.states.sources.set(sourceName, {
						sourceName: sourceName,
						validName: this.validName(sourceName),
						isGroup: sceneItem.isGroup,
						inputKind: sceneItem.inputKind,
					})
				}

				if (sceneItem.isGroup) {
					await this.getGroupInfo(sourceName)
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
				await this.getAudioSources(sourceName)
			}

			const sourceBatch = await this.sendBatch(batch)

			if (sourceBatch) {
				for (const response of sourceBatch) {
					if (response.requestStatus.result) {
						const sourceName = response.requestId
						const type = response.requestType
						const data = response.responseData
						const source = this.states.sources.get(sourceName)

						if (source) {
							switch (type) {
								case 'GetSourceActive':
									source.active = data.videoActive
									source.videoShowing = data.videoShowing
									break
								case 'GetSourceFilterList':
									this.states.sourceFilters.set(sourceName, data.filters)
									break
								case 'GetInputSettings':
									this.buildInputSettings(sourceName, data.inputKind, data.inputSettings)
									break
								default:
									break
							}
						}
					}
				}
				this.checkFeedbacks('scene_item_active')
			}
		}
	}

	async getGroupInfo(groupName: string): Promise<void> {
		const data = await this.sendRequest('GetGroupSceneItemList', { sceneName: groupName })
		if (data) {
			this.states.groups.set(groupName, data.sceneItems)
			await Promise.all(
				data.sceneItems?.map(async (sceneItem: any) => {
					const sourceName = sceneItem.sourceName
					let source = this.states.sources.get(sourceName)
					if (!source) {
						source = {
							sourceName: sourceName,
							validName: this.validName(sourceName),
							inputKind: sceneItem.inputKind,
						}
						this.states.sources.set(sourceName, source)
					}

					//Flag that this source is part of a group
					source.groupedSource = true
					source.groupName = groupName

					await this.getSourceFilters(sourceName)
					await this.getAudioSources(sourceName)

					if (sceneItem.inputKind) {
						const input = await this.sendRequest('GetInputSettings', { inputName: sourceName })

						if (input.inputSettings) {
							this.buildInputSettings(sourceName, sceneItem.inputKind, input.inputSettings)
						}
					}
				}) ?? [],
			)
		}
	}

	async buildSceneTransitionList(): Promise<void> {
		this.states.transitions.clear()

		const sceneTransitionList = await this.sendRequest('GetSceneTransitionList')
		const currentTransition = await this.sendRequest('GetCurrentSceneTransition')

		if (sceneTransitionList) {
			if (Array.isArray(sceneTransitionList.transitions)) {
				for (const item of sceneTransitionList.transitions) {
					this.states.transitions.set(item.transitionName, item)
				}
			}

			const transitionListVariable = this.transitionList?.map((item) => item.id) ?? []

			this.states.currentTransition = currentTransition?.transitionName ?? 'None'
			this.states.transitionDuration = currentTransition?.transitionDuration ?? '0'

			this.checkFeedbacks('transition_duration', 'current_transition')
			this.setVariableValues({
				current_transition: this.states.currentTransition,
				transition_duration: this.states.transitionDuration,
				transition_active: 'False',
				transition_list: transitionListVariable.join(', '),
			})
		}
	}

	//Scene and Source Actions
	async addScene(sceneName: string): Promise<void> {
		this.states.scenes.set(sceneName, { sceneName: sceneName, sceneIndex: this.states.scenes.size })
		await this.buildSourceList(sceneName)
		void this.updateActionsFeedbacksVariables()
	}

	async removeScene(sceneName: string): Promise<void> {
		this.states.scenes.delete(sceneName)
		this.states.sceneItems.delete(sceneName)
		void this.updateActionsFeedbacksVariables()
	}

	//Source Info
	async getMediaStatus(): Promise<void> {
		const batch = []
		for (const source of this.mediaSourceList) {
			const sourceName = source.id
			batch.push({
				requestId: sourceName,
				requestType: 'GetMediaInputStatus',
				requestData: { inputName: sourceName },
			})
		}

		const data = await this.sendBatch(batch)

		if (data) {
			const currentMedia = []
			for (const response of data) {
				if (response.requestStatus.result) {
					const sourceName = response.requestId
					const validName = this.sources.get(sourceName)?.validName ?? sourceName
					const data = response.responseData

					this.states.mediaSources.set(sourceName, data)

					const remainingValue = (data?.mediaDuration ?? 0) - (data?.mediaCursor ?? 0)
					let remaining: string
					if (remainingValue > 0) {
						remaining = this.formatTimecode(remainingValue)
					} else {
						remaining = '--:--:--'
					}

					let mediaSource = this.states.mediaSources.get(sourceName)
					if (mediaSource) {
						mediaSource.timeElapsed = this.formatTimecode(data.mediaCursor)
						mediaSource.timeRemaining = remaining
					}

					if (data?.mediaState) {
						switch (data?.mediaState) {
							case 'OBS_MEDIA_STATE_PLAYING':
								if (this.sources.get(sourceName)?.active == true) {
									mediaSource = this.states.mediaSources.get(sourceName)
									currentMedia.push({
										name: sourceName,
										elapsed: mediaSource?.timeElapsed,
										remaining: mediaSource?.timeRemaining,
									})
								}
								this.setVariableValues({
									[`media_status_${validName}`]: 'Playing',
								})
								break
							case 'OBS_MEDIA_STATE_PAUSED':
								if (this.sources.get(sourceName)?.active == true) {
									mediaSource = this.states.mediaSources.get(sourceName)
									currentMedia.push({
										name: sourceName,
										elapsed: mediaSource?.timeElapsed,
										remaining: mediaSource?.timeRemaining,
									})
								}
								this.setVariableValues({ [`media_status_${validName}`]: 'Paused' })
								break
							default:
								this.setVariableValues({ [`media_status_${validName}`]: 'Stopped' })
								break
						}
					}
					mediaSource = this.states.mediaSources.get(sourceName)
					this.setVariableValues({
						[`media_time_elapsed_${validName}`]: mediaSource?.timeElapsed,
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

	buildInputSettings(sourceName: string, inputKind: string, inputSettings: unknown): void {
		const source = this.states.sources.get(sourceName)
		const name = source?.validName ?? sourceName

		const kindList = this.states.inputKindList.get(inputKind)
		if (kindList?.defaultInputSettings) {
			inputSettings = { ...kindList.defaultInputSettings, ...(inputSettings as any) }
			if (source) source.settings = inputSettings
		} else {
			if (source) source.settings = inputSettings
		}

		const settings = inputSettings as any
		switch (inputKind) {
			case 'text_ft2_source_v2':
			case 'text_gdiplus_v2':
			case 'text_gdiplus_v3':
				//Exclude text sources that read from file, as there is no way to edit or read the text value
				if (settings?.from_file || settings?.read_from_file) {
					this.setVariableValues({
						[`current_text_${name}`]: `Text from file: ${settings.text_file ?? settings.file}`,
					})
				} else {
					this.states.textSources.set(sourceName, {})
					this.setVariableValues({
						[`current_text_${name}`]: settings.text ?? '',
					})
				}
				break
			case 'ffmpeg_source':
			case 'vlc_source':
				this.states.mediaSources.set(sourceName, {})
				if (!this.mediaPoll) {
					void this.startMediaPoll()
				}
				break
			case 'image_source':
				this.states.imageSources.set(sourceName, {})
				break
			default:
				break
		}
	}

	updateInputSettings(sourceName: string, inputSettings: unknown): void {
		const source = this.states.sources.get(sourceName)
		if (source) {
			source.settings = {
				...(source.settings || {}),
				...((inputSettings as any) || {}),
			}
			const name = source.validName ?? sourceName
			const inputKind = source.inputKind
			const settings = inputSettings as any

			switch (inputKind) {
				case 'text_ft2_source_v2':
				case 'text_gdiplus_v2':
				case 'text_gdiplus_v3':
					//Exclude text sources that read from file, as there is no way to edit or read the text value
					if (settings?.from_file || settings?.read_from_file) {
						this.setVariableValues({
							[`current_text_${name}`]: `Text from file: ${settings.text_file ?? settings.file}`,
						})
					} else if (settings?.text) {
						this.setVariableValues({
							[`current_text_${name}`]: settings.text ?? '',
						})
					}
					break
				case 'ffmpeg_source':
				case 'vlc_source': {
					let file = ''
					if (settings?.playlist) {
						file = settings?.playlist[0]?.value?.match(/[^\\/]+(?=\.[\w]+$)|[^\\/]+$/)?.[0] ?? ''
						//Use first value in playlist until support for determining currently playing cue
					} else if (settings?.local_file) {
						file = settings?.local_file?.match(/[^\\/]+(?=\.[\w]+$)|[^\\/]+$/)?.[0] ?? ''
					}
					this.setVariableValues({ [`media_file_name_${name}`]: file })

					break
				}
				case 'image_source':
					this.setVariableValues({
						[`image_file_name_${name}`]: settings?.file ? settings?.file?.match(/[^\\/]+(?=\.[\w]+$)|[^\\/]+$/) : '',
					})
					break
				default:
					break
			}
		}
	}

	async getSourceFilters(sourceName: string): Promise<void> {
		const data = await this.sendRequest('GetSourceFilterList', { sourceName: sourceName })

		if (data?.filters) {
			this.states.sourceFilters.set(sourceName, data.filters)
		}
	}

	//Audio Sources
	async getAudioSources(sourceName: string): Promise<void> {
		try {
			await this.obs.call('GetInputAudioTracks', { inputName: sourceName })
			if (!this.audioSourceList.find((item) => item.id === sourceName)) {
				await this.getSourceAudio(sourceName)
			}
		} catch {
			//Ignore, this source is not an audio source
		}
	}

	async getSourceAudio(sourceName: string): Promise<void> {
		const source = this.states.sources.get(sourceName)
		const validName = source?.validName ?? this.validName(sourceName)

		const batch = [
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
		] as any[]

		const data = await this.sendBatch(batch)

		if (data) {
			for (const response of data) {
				if (response.requestStatus.result && response.responseData) {
					const sourceName = response.requestId
					const type = response.requestType
					const responseData = response.responseData
					const source = this.states.sources.get(sourceName)

					if (source) {
						switch (type) {
							case 'GetInputMute':
								source.inputMuted = responseData.inputMuted
								this.setVariableValues({ [`mute_${validName}`]: responseData.inputMuted ? 'Muted' : 'Unmuted' })
								break
							case 'GetInputVolume':
								source.inputVolume = this.roundNumber(responseData.inputVolumeDb, 1)
								this.setVariableValues({ [`volume_${validName}`]: source.inputVolume + ' dB' })
								break
							case 'GetInputAudioBalance':
								source.inputAudioBalance = this.roundNumber(responseData.inputAudioBalance, 1)
								this.setVariableValues({ [`balance_${validName}`]: source.inputAudioBalance })
								break
							case 'GetInputAudioSyncOffset':
								source.inputAudioSyncOffset = responseData.inputAudioSyncOffset
								this.setVariableValues({ [`sync_offset_${validName}`]: responseData.inputAudioSyncOffset + 'ms' })
								break
							case 'GetInputAudioMonitorType': {
								source.monitorType = responseData.monitorType
								let monitorType
								if (responseData.monitorType === 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT') {
									monitorType = 'Monitor / Output'
								} else if (responseData.monitorType === 'OBS_MONITORING_TYPE_MONITOR_ONLY') {
									monitorType = 'Monitor Only'
								} else {
									monitorType = 'Off'
								}
								this.setVariableValues({ [`monitor_${validName}`]: monitorType })
								break
							}
							case 'GetInputAudioTracks':
								source.inputAudioTracks = responseData.inputAudioTracks
								break
							default:
								break
						}
					}
				}
			}

			if (source) {
				this.setVariableValues({
					[`mute_${validName}`]: source.inputMuted ? 'Muted' : 'Unmuted',
					[`volume_${validName}`]: source.inputVolume + 'dB',
					[`balance_${validName}`]: source.inputAudioBalance,
					[`sync_offset_${validName}`]: source.inputAudioSyncOffset + 'ms',
				})
			}
			this.checkFeedbacks('audio_muted', 'volume', 'audio_monitor_type')
		}
	}

	updateAudioPeak(data: unknown): void {
		this.states.audioPeak.clear()
		;(data as any).inputs.forEach((input: any) => {
			const channel = input.inputLevelsMul[0]
			if (channel) {
				const channelPeak = channel?.[1]
				const dbPeak = Math.round(20.0 * Math.log10(channelPeak))
				if (dbPeak) {
					this.states.audioPeak.set(input.inputName, dbPeak)
					this.checkFeedbacks('audioPeaking', 'audioMeter')
				}
			}
		})
	}
}
runEntrypoint(OBSInstance, UpgradeScripts as any)
