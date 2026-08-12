import { createModuleLogger, type CompanionOptionValues } from '@companion-module/base'
import type OBSInstance from './main.js'
import type { OBSFeedbackId } from './feedbacks.js'
import type { OBSReindexedSceneItem, OBSScene, OBSSource, OBSVolumeMetersEvent } from './types.js'
import type OBSWebSocket from 'obs-websocket-js'
import * as utils from './utils.js'
import {
	OBSMediaStatus,
	OBSMediaInputAction,
	OBSRecordingState,
	OBSStreamingState,
	ObsAudioMonitorType,
} from './types.js'

const logger = createModuleLogger('Listeners')

// OBS Listeners
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

// General Listeners
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
			logger.debug(`Vendor Event Error: ${error}`)
		}
		self.setVariableValues({
			vendor_event_name: data.vendorName,
			vendor_event_type: data.eventType,
			vendor_event_data: eventData,
		})
		self.checkFeedbacks('vendorEvent')
	})
}

// Config Listeners
function setupConfigListeners(self: OBSInstance, obs: OBSWebSocket): void {
	obs.on('CurrentSceneCollectionChanging', () => {
		self.obs.stopMediaPoll()
		self.states.sceneCollectionChanging = true
	})
	obs.on('CurrentSceneCollectionChanged', (data) => {
		self.states.currentSceneCollection = data.sceneCollectionName
		void self.checkFeedbacks('scene_collection_active')
		self.setVariableValues({ scene_collection: self.states.currentSceneCollection })
		self.states.sceneCollectionChanging = false
		// buildSceneList resets state and registers all inputs.
		void self.obs.buildSceneList()
		void self.obs.buildSceneTransitionList()
		void self.obs.profileInfo()
	})
	obs.on('SceneCollectionListChanged', () => {
		void self.obs.buildSceneCollectionList()
	})
	obs.on('CurrentProfileChanging', () => {})
	obs.on('CurrentProfileChanged', (data) => {
		self.states.currentProfile = data.profileName
		void self.checkFeedbacks('profile_active')
		self.setVariableValues({ profile: self.states.currentProfile })
		void self.obs.profileInfo()
	})
	obs.on('ProfileListChanged', () => {
		void self.obs.buildProfileList()
	})
}

// Scene Listeners
function setupSceneListeners(self: OBSInstance, obs: OBSWebSocket): void {
	obs.on('SceneCreated', (data) => {
		if (data?.isGroup === false && self.states.sceneCollectionChanging === false) {
			self.obs.registerScene(data.sceneUuid, data.sceneName)
			void self.obs.buildSourceList(data.sceneUuid)
			void self.updateActionsFeedbacksVariables()
		}
	})
	obs.on('SceneRemoved', (data) => {
		if (data?.isGroup === false && self.states.sceneCollectionChanging === false) {
			void self.obs.removeScene(data.sceneUuid)
		}
	})
	obs.on('SceneNameChanged', (data) => {
		const scene = self.states.scenes.get(data.sceneUuid)
		if (scene) {
			scene.sceneName = data.sceneName
			self.obsState.invalidateSceneNameIndex()
		}
		void self.updateActionsFeedbacksVariables()
	})
	obs.on('CurrentProgramSceneChanged', (data) => {
		self.states.previousScene = self.states.programScene
		self.states.previousSceneUuid = self.states.programSceneUuid
		self.states.programScene = data.sceneName
		self.states.programSceneUuid = data.sceneUuid
		self.setVariableValues({ scene_active: self.states.programScene, scene_previous: self.states.previousScene })
		self.checkFeedbacks(
			'scene_active',
			'sceneProgram',
			'scenePrevious',
			'scene_item_active',
			'scene_item_active_in_scene',
		)
		self.sendToActionRecorder({ actionId: 'set_scene', options: { scene: data.sceneName } })
	})
	obs.on('CurrentPreviewSceneChanged', (data) => {
		self.states.previewScene = data.sceneName ?? 'None'
		self.states.previewSceneUuid = data.sceneUuid ?? ''
		self.setVariableValues({ scene_preview: self.states.previewScene })
		self.checkFeedbacks('scene_active', 'scenePreview')
		self.sendToActionRecorder({ actionId: 'preview_scene', options: { scene: data.sceneName } })
	})
	obs.on('SceneListChanged', (data) => {
		self.states.scenes.clear()
		for (const scene of data.scenes as unknown as OBSScene[]) {
			self.states.scenes.set(scene.sceneUuid, {
				sceneName: scene.sceneName,
				sceneUuid: scene.sceneUuid,
				sceneIndex: scene.sceneIndex,
			})
		}
		self.obsState.invalidateSceneNameIndex()
		// Refresh definitions so reordered scene positions don't go stale.
		void self.updateActionsFeedbacksVariables()
	})
}

// Input Listeners
function setupInputListeners(self: OBSInstance, obs: OBSWebSocket): void {
	obs.on('InputCreated', (data) => {
		// Skip per-input work during bulk scene collection loads.
		if (self.states.sceneCollectionChanging) return
		self.obs.addSource(data.inputUuid, data.inputName, data.inputKind)
		void self.obs.fetchSourcesData([data.inputUuid]).then(() => {
			self.updateActionsFeedbacksVariables()
		})
	})
	obs.on('InputRemoved', (data) => {
		self.states.sources.delete(data.inputUuid)
		// Clear filters and peak state for removed input.
		self.states.sourceFilters.delete(data.inputUuid)
		self.states.audioPeak.delete(data.inputUuid)
		self.obsState.invalidateSourceNameIndex()
		void self.updateActionsFeedbacksVariables()
	})
	obs.on('InputNameChanged', (data) => {
		const source = self.states.sources.get(data.inputUuid)
		if (source) {
			source.sourceName = data.inputName
			source.validName = utils.validName(data.inputName)
			self.obsState.invalidateSourceNameIndex()
		}
		void self.updateActionsFeedbacksVariables()
	})
	obs.on('InputActiveStateChanged', (data) => {
		updateSourceProperty(self, data.inputUuid, 'active', data.videoActive, 'scene_item_active')
		const source = self.states.sources.get(data.inputUuid)
		if (source) {
			const sourceName = source.validName ?? utils.validName(source.sourceName)
			self.setVariableValues({ [`source_active_${sourceName}`]: data.videoActive })
		}
	})
	obs.on('InputShowStateChanged', (data) => {
		updateSourceProperty(self, data.inputUuid, 'videoShowing', data.videoShowing, 'scene_item_previewed')
	})
	obs.on('InputMuteStateChanged', (data) => {
		const source = self.states.sources.get(data.inputUuid)
		if (source) {
			source.inputMuted = data.inputMuted
			const name = source.validName ?? data.inputUuid
			self.setVariableValues({
				[`mute_${name}`]: source.inputMuted ? 'Muted' : 'Unmuted',
			})
			self.checkFeedbacks('audio_muted')
			self.sendToActionRecorder({
				actionId: 'set_source_mute',
				options: { source: source.sourceName, mute: data.inputMuted ? 'true' : 'false' },
			})
		}
	})
	obs.on('InputVolumeChanged', (data) => {
		const source = self.states.sources.get(data.inputUuid)
		if (source) {
			source.inputVolume = utils.roundNumber(data.inputVolumeDb, 1)
			const name = source.validName ?? data.inputUuid
			self.setVariableValues({ [`volume_${name}`]: source.inputVolume })
			self.checkFeedbacks('volume')
			self.sendToActionRecorder({
				actionId: 'set_volume',
				options: { source: source.sourceName, volume: source.inputVolume },
			})
		}
	})
	obs.on('InputAudioBalanceChanged', (data) => {
		const source = self.states.sources.get(data.inputUuid)
		if (source) {
			source.inputAudioBalance = utils.roundNumber(data.inputAudioBalance, 1)
			const name = source.validName ?? data.inputUuid
			self.setVariableValues({ [`balance_${name}`]: source.inputAudioBalance })
			self.sendToActionRecorder({
				actionId: 'set_audio_balance',
				options: { source: source.sourceName, balance: source.inputAudioBalance },
			})
		}
	})
	obs.on('InputAudioSyncOffsetChanged', (data) => {
		const source = self.states.sources.get(data.inputUuid)
		if (source) {
			source.inputAudioSyncOffset = data.inputAudioSyncOffset
			const name = source.validName ?? data.inputUuid
			self.setVariableValues({ [`sync_offset_${name}`]: source.inputAudioSyncOffset })
			self.sendToActionRecorder({
				actionId: 'set_audio_offset',
				options: { source: source.sourceName, offset: data.inputAudioSyncOffset },
			})
		}
	})
	obs.on('InputAudioTracksChanged', (data) => {
		const source = self.states.sources.get(data.inputUuid)
		if (source) {
			source.inputAudioTracks = data.inputAudioTracks
		}
	})
	obs.on('InputAudioMonitorTypeChanged', (data) => {
		const source = self.states.sources.get(data.inputUuid)
		if (source) {
			source.monitorType = data.monitorType as ObsAudioMonitorType
			const name = source.validName ?? data.inputUuid
			self.setVariableValues({ [`monitor_${name}`]: utils.getMonitorTypeLabel(data.monitorType) })
			self.checkFeedbacks('audio_monitor_type')
			self.sendToActionRecorder({
				actionId: 'set_audio_monitor',
				options: { source: source.sourceName, monitor: data.monitorType },
			})
		}
	})
	obs.on('InputVolumeMeters', (data) => {
		self.obs.updateAudioPeak(data as unknown as OBSVolumeMetersEvent)
	})
	obs.on('InputSettingsChanged', (data) => {
		const sourceUuid = data.inputUuid
		const settings = data.inputSettings

		self.obs.updateInputSettings(sourceUuid, settings)
	})
}

function updateSourceProperty(
	self: OBSInstance,
	uuid: string,
	property: keyof OBSSource,
	value: unknown,
	feedback?: OBSFeedbackId | OBSFeedbackId[],
): void {
	const source = self.states.sources.get(uuid)
	if (source) {
		;(source as unknown as Record<string, unknown>)[property as string] = value
		if (feedback) {
			if (Array.isArray(feedback)) {
				if (feedback.length > 0) {
					self.checkFeedbacks(feedback[0], ...feedback.slice(1))
				}
			} else {
				self.checkFeedbacks(feedback)
			}
		}
	}
}

// Transition Listeners
function setupTransitionListeners(self: OBSInstance, obs: OBSWebSocket): void {
	obs.on('CurrentSceneTransitionChanged', (data) => {
		void (async () => {
			const transition = await self.obs.sendRequest('GetCurrentSceneTransition')

			self.states.currentTransition = data.transitionName
			self.states.transitionDuration = transition?.transitionDuration ?? 0

			self.checkFeedbacks('transition_duration', 'current_transition')
			self.setVariableValues({
				current_transition: self.states.currentTransition,
				transition_duration: self.states.transitionDuration,
			})

			if (!self.obsState.transitionList?.find((item) => item.id === data.transitionName)) {
				void self.obs.buildSceneTransitionList()
				void self.updateActionsFeedbacksVariables()
			}
			self.sendToActionRecorder({ actionId: 'set_transition_type', options: { transitions: data.transitionName } })
		})()
	})
	obs.on('CurrentSceneTransitionDurationChanged', (data) => {
		self.states.transitionDuration = data.transitionDuration ?? 0
		self.checkFeedbacks('transition_duration')
		self.setVariableValues({ transition_duration: self.states.transitionDuration })
		self.sendToActionRecorder({ actionId: 'set_transition_duration', options: { duration: data.transitionDuration } })
	})
	obs.on('SceneTransitionStarted', () => {
		self.states.transitionActive = true
		self.setVariableValues({ transition_active: self.states.transitionActive })
		self.checkFeedbacks('transition_active')
	})
	obs.on('SceneTransitionEnded', () => {
		self.states.transitionActive = false
		self.setVariableValues({ transition_active: self.states.transitionActive })
		self.checkFeedbacks('transition_active')
	})
	obs.on('SceneTransitionVideoEnded', () => {})
}

function refreshSourceFilters(self: OBSInstance, sourceUuid: string): void {
	void self.obs.getSourceFilters(sourceUuid).then(() => {
		self.updateActionsFeedbacksVariables()
	})
}

// Filter Listeners
function setupFilterListeners(self: OBSInstance, obs: OBSWebSocket): void {
	obs.on('SourceFilterListReindexed', () => {})
	obs.on('SourceFilterCreated', (data) => {
		const uuid = self.obsState.findFilterTargetUuid(data.sourceName)
		if (uuid) {
			refreshSourceFilters(self, uuid)
		}
	})
	obs.on('SourceFilterRemoved', (data) => {
		const uuid = self.obsState.findFilterTargetUuid(data.sourceName)
		if (uuid) {
			refreshSourceFilters(self, uuid)
		}
	})
	obs.on('SourceFilterNameChanged', (data) => {
		const uuid = self.obsState.findFilterTargetUuid(data.sourceName)
		if (uuid) {
			refreshSourceFilters(self, uuid)
		}
	})
	obs.on('SourceFilterSettingsChanged', (data) => {
		// Sync cached filter settings to prevent stale reads in the actions layer.
		const uuid = self.obsState.findFilterTargetUuid(data.sourceName)
		if (uuid) {
			const filter = self.states.sourceFilters.get(uuid)?.find((f) => f.filterName === data.filterName)
			if (filter) {
				filter.filterSettings = data.filterSettings
			}
		}
	})
	obs.on('SourceFilterEnableStateChanged', (data) => {
		const uuid = self.obsState.findFilterTargetUuid(data.sourceName)
		if (uuid) {
			const sourceFilters = self.states.sourceFilters.get(uuid)
			if (sourceFilters) {
				const filter = sourceFilters.find((item) => item.filterName === data.filterName)
				if (filter) {
					filter.filterEnabled = data.filterEnabled
					self.checkFeedbacks('filter_enabled')
				}
			}
			self.sendToActionRecorder({
				actionId: 'toggle_filter',
				options: {
					allSources: false,
					source: data.sourceName,
					filter: data.filterName,
					visible: data.filterEnabled ? 'true' : 'false',
				},
			})
		}
	})
}

// Scene Item Listeners
function setupSceneItemListeners(self: OBSInstance, obs: OBSWebSocket): void {
	obs.on('SceneItemCreated', (data) => {
		if (self.states.sceneCollectionChanging === false) {
			void self.obs.addSceneItem(data.sceneUuid, data.sourceUuid).then(() => {
				void self.updateActionsFeedbacksVariables()
			})
		}
	})
	obs.on('SceneItemRemoved', (data) => {
		if (self.states.sceneCollectionChanging === false) {
			// sceneUuid represents the container (scene or group) in the sceneItems map.
			const items = self.states.sceneItems.get(data.sceneUuid)
			if (items) {
				const itemIndex = items.findIndex((item) => item.sceneItemId === data.sceneItemId)
				if (itemIndex > -1) {
					items.splice(itemIndex, 1)
				}
			}
			void self.updateActionsFeedbacksVariables()
		}
	})
	obs.on('SceneItemListReindexed', (data) => {
		// OBS sends minimal item objects here (sceneItemId + sceneItemIndex); only update ordering
		// on the cached items rather than replacing them, to avoid dropping other cached fields.
		const items = self.states.sceneItems.get(data.sceneUuid)
		if (!items) return
		const reindexedItems = data.sceneItems as unknown as OBSReindexedSceneItem[]
		const indexByItemId = new Map(reindexedItems.map((item) => [item.sceneItemId, item.sceneItemIndex]))
		for (const item of items) {
			const newIndex = indexByItemId.get(item.sceneItemId)
			if (newIndex !== undefined) item.sceneItemIndex = newIndex
		}
	})
	obs.on('SceneItemEnableStateChanged', (data) => {
		const items = self.states.sceneItems.get(data.sceneUuid)
		let sourceUuid: string | undefined
		const sceneItem = items?.find((item) => item.sceneItemId === data.sceneItemId)
		if (sceneItem) {
			sceneItem.sceneItemEnabled = data.sceneItemEnabled
			sourceUuid = sceneItem.sourceUuid
		}
		self.checkFeedbacks('scene_item_active_in_scene')
		const sceneName = self.states.scenes.get(data.sceneUuid)?.sceneName
		const sourceName = sourceUuid ? self.states.sources.get(sourceUuid)?.sourceName : undefined
		if (sourceName && sceneName) {
			self.sendToActionRecorder({
				actionId: 'toggle_scene_item',
				options: {
					anyScene: false,
					useCurrentScene: false,
					scene: sceneName,
					source: sourceName,
					visible: data.sceneItemEnabled ? 'true' : 'false',
				},
			})
		}
	})
	obs.on('SceneItemLockStateChanged', () => {})
	obs.on('SceneItemSelected', () => {})
	obs.on('SceneItemTransformChanged', () => {})
}

// Output Listeners
function setupOutputListeners(self: OBSInstance, obs: OBSWebSocket): void {
	obs.on('StreamStateChanged', (data) => {
		const outputState = data.outputState as OBSStreamingState
		self.states.streaming = data.outputActive
		self.states.streamReconnecting = outputState === OBSStreamingState.Reconnecting

		// Reflect reconnect transitions or fall back to active status.
		const streamingState = self.states.streamReconnecting
			? OBSStreamingState.Reconnecting
			: self.states.streaming
				? OBSStreamingState.Streaming
				: OBSStreamingState.OffAir
		self.setVariableValues({ streaming: utils.getOBSStreamingStateLabel(streamingState) })
		self.checkFeedbacks('streaming', 'streamCongestion', 'streamReconnecting')
		if (self.states.streaming === false) {
			self.setVariableValues({
				stream_timecode: '00:00:00',
				stream_timecode_hh: '00',
				stream_timecode_mm: '00',
				stream_timecode_ss: '00',
			})
		}
		// Skip recording reconnect transitions as start/stop actions.
		const isReconnectTransition =
			outputState === OBSStreamingState.Reconnecting || outputState === OBSStreamingState.Reconnected
		if (!isReconnectTransition) {
			self.sendToActionRecorder({ actionId: data.outputActive ? 'start_streaming' : 'stop_streaming', options: {} })
		}
	})
	obs.on('RecordStateChanged', (data) => {
		const previousRecordingState = self.states.recording
		// Normalize OBS_WEBSOCKET_OUTPUT_RESUMED to Recording state.
		self.states.recording =
			data.outputState === 'OBS_WEBSOCKET_OUTPUT_RESUMED'
				? OBSRecordingState.Recording
				: (data.outputState as OBSRecordingState)

		if (data.outputPath) {
			self.setVariableValues({
				recording_file_name: data.outputPath.match(/[^\\/]+(?=\.[\w]+$)|[^\\/]+$/)?.[0] ?? '',
			})
		}

		self.setVariableValues({ recording: utils.getOBSRecordingStateLabel(self.states.recording) })
		self.checkFeedbacks('recording', 'recordingPaused')
		// RecordStateChanged carries no timecode; pass none so the handler takes its reset path.
		self.obs.updateRecordingTimecode(undefined)

		if (data.outputActive && previousRecordingState === OBSRecordingState.Paused) {
			self.sendToActionRecorder({ actionId: 'resume_recording', options: {} })
		} else if (data.outputActive) {
			self.sendToActionRecorder({ actionId: 'start_recording', options: {} })
		} else if (data.outputState === 'OBS_WEBSOCKET_OUTPUT_PAUSED') {
			self.sendToActionRecorder({ actionId: 'pause_recording', options: {} })
		} else {
			self.sendToActionRecorder({ actionId: 'stop_recording', options: {} })
		}
	})
	obs.on('ReplayBufferStateChanged', (data) => {
		self.states.replayBuffer = data.outputActive
		self.checkFeedbacks('replayBufferActive')
		self.sendToActionRecorder({
			actionId: data.outputActive ? 'start_replay_buffer' : 'stop_replay_buffer',
			options: {},
		})
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
		self.sendToActionRecorder({
			actionId: data.outputActive ? 'start_output' : 'stop_output',
			options: { output: 'virtualcam_output' },
		})
	})
	obs.on('ReplayBufferSaved', (data) => {
		self.setVariableValues({ replay_buffer_path: data.savedReplayPath })
	})
}

// Set source media status and variable.
function setMediaStatus(self: OBSInstance, source: OBSSource, uuid: string, status: OBSMediaStatus): void {
	source.OBSMediaStatus = status
	const name = source.validName ?? uuid
	self.setVariableValues({ [`media_status_${name}`]: utils.getOBSMediaStatusLabel(status) })
}

// Map media action to recorder entry.
const MEDIA_ACTION_RECORDER_MAP: Partial<
	Record<OBSMediaInputAction, { actionId: string; playPause?: 'play' | 'pause' }>
> = {
	[OBSMediaInputAction.Pause]: { actionId: 'play_pause_media', playPause: 'pause' },
	[OBSMediaInputAction.Play]: { actionId: 'play_pause_media', playPause: 'play' },
	[OBSMediaInputAction.Restart]: { actionId: 'restart_media' },
	[OBSMediaInputAction.Stop]: { actionId: 'stop_media' },
	[OBSMediaInputAction.Next]: { actionId: 'next_media' },
	[OBSMediaInputAction.Previous]: { actionId: 'previous_media' },
}

// Media Listeners
function setupMediaListeners(self: OBSInstance, obs: OBSWebSocket): void {
	obs.on('MediaInputPlaybackStarted', (data) => {
		const source = self.states.sources.get(data.inputUuid)
		// Store name instead of UUID since currentMedia is consumed as input name.
		self.states.currentMedia = source?.sourceName ?? ''
		if (source) setMediaStatus(self, source, data.inputUuid, OBSMediaStatus.Playing)
	})
	obs.on('MediaInputPlaybackEnded', (data) => {
		const source = self.states.sources.get(data.inputUuid)
		if (source) setMediaStatus(self, source, data.inputUuid, OBSMediaStatus.Ended)
	})
	obs.on('MediaInputActionTriggered', (data) => {
		const action = data.mediaAction as OBSMediaInputAction
		const source = self.states.sources.get(data.inputUuid)
		if (source) {
			if (action === OBSMediaInputAction.Pause) {
				setMediaStatus(self, source, data.inputUuid, OBSMediaStatus.Paused)
			} else if (action === OBSMediaInputAction.Play) {
				setMediaStatus(self, source, data.inputUuid, OBSMediaStatus.Playing)
			}
		}

		const mapping = MEDIA_ACTION_RECORDER_MAP[action]
		if (mapping) {
			const mediaOptions: CompanionOptionValues = { source: source?.sourceName ?? '', useCurrentMedia: false }
			if (mapping.playPause) mediaOptions.playPause = mapping.playPause
			self.sendToActionRecorder({ actionId: mapping.actionId, options: mediaOptions })
		}
	})
}

// UI Listeners
function setupUIListeners(self: OBSInstance, obs: OBSWebSocket): void {
	obs.on('ScreenshotSaved', (data) => {
		self.setVariableValues({ screenshot_saved_path: data.savedScreenshotPath })
	})
	obs.on('StudioModeStateChanged', (data) => {
		self.sendToActionRecorder({
			actionId: data.studioModeEnabled ? 'enable_studio_mode' : 'disable_studio_mode',
			options: {},
		})
		void (async () => {
			self.states.studioMode = data.studioModeEnabled ?? false
			self.checkFeedbacks('studioMode')

			if (self.states.studioMode) {
				const preview = await self.obs.sendRequest('GetCurrentPreviewScene')
				self.states.previewScene = preview?.sceneName ?? 'None'
				self.states.previewSceneUuid = preview?.sceneUuid ?? ''
			} else {
				self.states.previewScene = 'None'
				self.states.previewSceneUuid = ''
			}
			self.checkFeedbacks('studioMode', 'scenePreview')
			self.setVariableValues({ scene_preview: self.states.previewScene })
		})()
	})
}
