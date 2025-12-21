import type { OBSInstance } from './main.js'
import type OBSWebSocket from 'obs-websocket-js'
import * as utils from './utils.js'

export function initOBSListeners(self: OBSInstance): void {
	const obs = self.socket

	setupGeneralListeners(self, obs)
	setupConfigListeners(self, obs)
	setupSceneListeners(self, obs)
	setupInputListeners(self, obs)
	setupTransitionListeners(self, obs)
	setupFilterListeners(self, obs)
	setupSceneItemListeners(self, obs)
	setupOutputListeners(self, obs)
	setupMediaListeners(self, obs)
	setupUIListeners(self, obs)
}

function setupGeneralListeners(self: OBSInstance, obs: OBSWebSocket): void {
	obs.once('ExitStarted', () => {
		void self.obs.connectionLost()
	})
	obs.on('ConnectionClosed', () => {
		void self.obs.connectionLost()
	})
	obs.on('VendorEvent', (data) => {
		self.states.vendorEvent = data
		let eventData = ''
		try {
			eventData = JSON.stringify(data.eventData)
		} catch (error) {
			self.log('debug', `Vendor Event Error: ${error}`)
		}
		self.setVariableValues({
			vendor_event_name: data.vendorName,
			vendor_event_type: data.eventType,
			vendor_event_data: eventData,
		})
		self.checkFeedbacks('vendorEvent')
	})
}

function setupConfigListeners(self: OBSInstance, obs: OBSWebSocket): void {
	obs.on('CurrentSceneCollectionChanging', () => {
		void self.obs.stopMediaPoll()
		self.states.sceneCollectionChanging = true
	})
	obs.on('CurrentSceneCollectionChanged', (data) => {
		self.states.currentSceneCollection = data.sceneCollectionName
		void self.checkFeedbacks('scene_collection_active')
		self.setVariableValues({ scene_collection: self.states.currentSceneCollection })
		self.states.sceneCollectionChanging = false
		self.obsState.resetSceneSourceStates()
		void self.obs.buildSceneList()
		void self.obs.buildSceneTransitionList()
		void self.obs.obsInfo()
	})
	obs.on('SceneCollectionListChanged', () => {
		void self.obs.buildSceneCollectionList()
	})
	obs.on('CurrentProfileChanging', () => {})
	obs.on('CurrentProfileChanged', (data) => {
		self.states.currentProfile = data.profileName
		void self.checkFeedbacks('profile_active')
		self.setVariableValues({ profile: self.states.currentProfile })
		void self.obs.obsInfo()
	})
	obs.on('ProfileListChanged', () => {
		void self.obs.buildProfileList()
	})
}

function setupSceneListeners(self: OBSInstance, obs: OBSWebSocket): void {
	obs.on('SceneCreated', (data) => {
		if (data?.isGroup === false && self.states.sceneCollectionChanging === false) {
			void self.obs.addScene(data.sceneName)
		}
	})
	obs.on('SceneRemoved', (data) => {
		if (data?.isGroup === false && self.states.sceneCollectionChanging === false) {
			void self.obs.removeScene(data.sceneName)
		}
	})
	obs.on('SceneNameChanged', (data) => {
		const sceneItems = self.states.sceneItems.get(data.oldSceneName)
		if (sceneItems) {
			self.states.sceneItems.set(data.sceneName, sceneItems)
			self.states.sceneItems.delete(data.oldSceneName)
		}
		void self.updateActionsFeedbacksVariables()
	})
	obs.on('CurrentProgramSceneChanged', (data) => {
		self.states.previousScene = self.states.programScene
		self.states.programScene = data.sceneName
		self.setVariableValues({ scene_active: self.states.programScene, scene_previous: self.states.previousScene })
		self.checkFeedbacks('scene_active', 'sceneProgram', 'scenePrevious')
	})
	obs.on('CurrentPreviewSceneChanged', (data) => {
		self.states.previewScene = data.sceneName ?? 'None'
		self.setVariableValues({ scene_preview: self.states.previewScene })
		self.checkFeedbacks('scene_active', 'scenePreview')
	})
	obs.on('SceneListChanged', (data) => {
		self.states.scenes.clear()
		for (const scene of data.scenes as any[]) {
			self.states.scenes.set(scene.sceneName, scene)
		}
	})
}

function setupInputListeners(self: OBSInstance, obs: OBSWebSocket): void {
	obs.on('InputCreated', () => {})
	obs.on('InputRemoved', (data) => {
		self.states.sources.delete(data.inputName)
		void self.updateActionsFeedbacksVariables()
	})
	obs.on('InputNameChanged', () => {})
	obs.on('InputActiveStateChanged', (data) => {
		const source = self.states.sources.get(data.inputName)
		if (source) {
			source.active = data.videoActive
			self.checkFeedbacks('scene_item_active')
		}
	})
	obs.on('InputShowStateChanged', (data) => {
		const source = self.states.sources.get(data.inputName)
		if (source) {
			source.videoShowing = data.videoShowing
			self.checkFeedbacks('scene_item_previewed')
		}
	})
	obs.on('InputMuteStateChanged', (data) => {
		const source = self.states.sources.get(data.inputName)
		if (source) {
			source.inputMuted = data.inputMuted
			const name = source.validName ?? data.inputName
			self.setVariableValues({
				[`mute_${name}`]: source.inputMuted ? 'Muted' : 'Unmuted',
			})
			self.checkFeedbacks('audio_muted')
		}
	})
	obs.on('InputVolumeChanged', (data) => {
		const source = self.states.sources.get(data.inputName)
		if (source) {
			source.inputVolume = utils.roundNumber(self, data.inputVolumeDb, 1)
			const name = source.validName ?? data.inputName
			self.setVariableValues({ [`volume_${name}`]: source.inputVolume + 'db' })
			self.checkFeedbacks('volume')
		}
	})
	obs.on('InputAudioBalanceChanged', (data) => {
		const source = self.states.sources.get(data.inputName)
		if (source) {
			source.inputAudioBalance = utils.roundNumber(self, data.inputAudioBalance, 1)
			const name = source.validName ?? data.inputName
			self.setVariableValues({ [`balance_${name}`]: source.inputAudioBalance })
		}
	})
	obs.on('InputAudioSyncOffsetChanged', (data) => {
		const source = self.states.sources.get(data.inputName)
		if (source) {
			source.inputAudioSyncOffset = data.inputAudioSyncOffset
			const name = source.validName ?? data.inputName
			self.setVariableValues({
				[`sync_offset_${name}`]: source.inputAudioSyncOffset + 'ms',
			})
		}
	})
	obs.on('InputAudioTracksChanged', () => {})
	obs.on('InputAudioMonitorTypeChanged', (data) => {
		const source = self.states.sources.get(data.inputName)
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
			self.setVariableValues({ [`monitor_${name}`]: monitorType })
			self.checkFeedbacks('audio_monitor_type')
		}
	})
	obs.on('InputVolumeMeters', (data) => {
		self.obs.updateAudioPeak(data)
	})
	obs.on('InputSettingsChanged', (data) => {
		const source = data.inputName
		const settings = data.inputSettings

		self.obs.updateInputSettings(source, settings)
	})
}

function setupTransitionListeners(self: OBSInstance, obs: OBSWebSocket): void {
	obs.on('CurrentSceneTransitionChanged', (data) => {
		void (async () => {
			const transition = await self.obs.sendRequest('GetCurrentSceneTransition')

			self.states.currentTransition = data.transitionName
			self.states.transitionDuration = transition?.transitionDuration ?? '0'

			self.checkFeedbacks('transition_duration', 'current_transition')
			self.setVariableValues({
				current_transition: self.states.currentTransition,
				transition_duration: self.states.transitionDuration,
			})

			if (!self.obsState.transitionList?.find((item) => item.id === data.transitionName)) {
				void self.obs.buildSceneTransitionList()
				void self.updateActionsFeedbacksVariables()
			}
		})()
	})
	obs.on('CurrentSceneTransitionDurationChanged', (data) => {
		self.states.transitionDuration = data.transitionDuration ?? '0'
		self.checkFeedbacks('transition_duration')
		self.setVariableValues({ transition_duration: self.states.transitionDuration })
	})
	obs.on('SceneTransitionStarted', () => {
		self.states.transitionActive = true
		self.setVariableValues({ transition_active: 'True' })
		self.checkFeedbacks('transition_active')
	})
	obs.on('SceneTransitionEnded', () => {
		self.states.transitionActive = false
		self.setVariableValues({ transition_active: 'False' })
		self.checkFeedbacks('transition_active')
	})
	obs.on('SceneTransitionVideoEnded', () => {})
}

function setupFilterListeners(self: OBSInstance, obs: OBSWebSocket): void {
	obs.on('SourceFilterListReindexed', () => {})
	obs.on('SourceFilterCreated', (data) => {
		void self.obs.getSourceFilters(data.sourceName)
	})
	obs.on('SourceFilterRemoved', (data) => {
		void self.obs.getSourceFilters(data.sourceName)
	})
	obs.on('SourceFilterNameChanged', () => {})
	obs.on('SourceFilterEnableStateChanged', (data) => {
		const sourceFilters = self.states.sourceFilters.get(data.sourceName)
		if (sourceFilters) {
			const filter = sourceFilters.find((item) => item.filterName == data.filterName)
			if (filter) {
				filter.filterEnabled = data.filterEnabled
				self.checkFeedbacks('filter_enabled')
			}
		}
	})
}

function setupSceneItemListeners(self: OBSInstance, obs: OBSWebSocket): void {
	obs.on('SceneItemCreated', (data) => {
		if (self.states.sceneCollectionChanging === false) {
			void self.obs.buildSourceList(data.sceneName)
		}
	})
	obs.on('SceneItemRemoved', (data) => {
		if (self.states.sceneCollectionChanging === false) {
			const sceneItems = self.states.sceneItems.get(data.sceneName)
			if (sceneItems) {
				const itemIndex = sceneItems.findIndex((item) => item.sceneItemId === data.sceneItemId)
				if (itemIndex > -1) {
					sceneItems.splice(itemIndex, 1)
				}
			}
			const groups = self.states.groups.get(data.sceneName)
			if (groups) {
				const itemIndex = groups.findIndex((item) => item.sceneItemId === data.sceneItemId)
				if (itemIndex > -1) {
					groups.splice(itemIndex, 1)
				}
			}
		}
	})
	obs.on('SceneItemListReindexed', () => {})
	obs.on('SceneItemEnableStateChanged', (data) => {
		const groups = self.states.groups.get(data.sceneName)
		const sceneItems = self.states.sceneItems.get(data.sceneName)
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
		self.checkFeedbacks('scene_item_active_in_scene')
	})
	obs.on('SceneItemLockStateChanged', () => {})
	obs.on('SceneItemSelected', () => {})
	obs.on('SceneItemTransformChanged', () => {})
}

function setupOutputListeners(self: OBSInstance, obs: OBSWebSocket): void {
	obs.on('StreamStateChanged', (data) => {
		self.states.streaming = data.outputActive

		self.setVariableValues({ streaming: self.states.streaming ? 'Live' : 'Off-Air' })
		self.checkFeedbacks('streaming', 'streamCongestion')
		if (self.states.streaming === false) {
			self.setVariableValues({
				stream_timecode: '00:00:00',
				stream_timecode_hh: '00',
				stream_timecode_mm: '00',
				stream_timecode_ss: '00',
			})
		}
	})
	obs.on('RecordStateChanged', (data) => {
		if (data.outputActive === true) {
			self.states.recording = 'Recording '
		} else {
			if (data.outputState === 'OBS_WEBSOCKET_OUTPUT_PAUSED') {
				self.states.recording = 'Paused'
			} else {
				self.states.recording = 'Stopped'
				self.setVariableValues({
					recording_timecode: '00:00:00',
					recording_timecode_hh: '00',
					recording_timecode_mm: '00',
					recording_timecode_ss: '00',
				})
			}
		}
		if (data.outputPath) {
			self.setVariableValues({
				recording_file_name: data.outputPath.match(/[^\\/]+(?=\.[\w]+$)|[^\\/]+$/)?.[0] ?? '',
			})
		}
		self.setVariableValues({ recording: self.states.recording })
		self.checkFeedbacks('recording')
	})
	obs.on('ReplayBufferStateChanged', (data) => {
		self.states.replayBuffer = data.outputActive
		self.checkFeedbacks('replayBufferActive')
	})
	obs.on('RecordFileChanged', (data) => {
		if (data.newOutputPath) {
			self.setVariableValues({
				recording_file_name: data.newOutputPath.match(/[^\\/]+(?=\.[\w]+$)|[^\\/]+$/)?.[0] ?? '',
			})
		}
	})
	obs.on('VirtualcamStateChanged', (data) => {
		const virtualCam = self.states.outputs.get('virtualcam_output')
		if (virtualCam) {
			virtualCam.outputActive = data.outputActive
			self.checkFeedbacks('output_active')
		}
	})
	obs.on('ReplayBufferSaved', (data) => {
		self.setVariableValues({ replay_buffer_path: data.savedReplayPath })
	})
}

function setupMediaListeners(self: OBSInstance, obs: OBSWebSocket): void {
	obs.on('MediaInputPlaybackStarted', (data) => {
		self.states.currentMedia = data.inputName

		const source = self.states.sources.get(data.inputName)
		const name = source?.validName ?? data.inputName
		self.setVariableValues({
			[`media_status_${name}`]: 'Playing',
		})
	})
	obs.on('MediaInputPlaybackEnded', (data) => {
		if (self.states.currentMedia == data.inputName) {
			const source = self.states.sources.get(data.inputName)
			const name = source?.validName ?? data.inputName
			self.setVariableValues({
				[`media_status_${name}`]: 'Stopped',
			})
		}
	})
	obs.on('MediaInputActionTriggered', (data) => {
		if (data.mediaAction == 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE') {
			const source = self.states.sources.get(data.inputName)
			const name = source?.validName ?? data.inputName
			self.setVariableValues({ [`media_status_${name}`]: 'Paused' })
		}
	})
}

function setupUIListeners(self: OBSInstance, obs: OBSWebSocket): void {
	obs.on('StudioModeStateChanged', (data) => {
		void (async () => {
			self.states.studioMode = data.studioModeEnabled ? true : false
			self.checkFeedbacks('studioMode')

			if (self.states.studioMode) {
				const preview = await self.obs.sendRequest('GetCurrentPreviewScene')
				self.states.previewScene = preview?.sceneName ?? 'None'
			} else {
				self.states.previewScene = 'None'
			}
			self.checkFeedbacks('studioMode', 'scenePreview')
			self.setVariableValues({ scene_preview: self.states.previewScene })
		})()
	})
}
