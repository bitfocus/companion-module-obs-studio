import type { JsonObject } from '@companion-module/base'
import type { OBSResponseTypes } from 'obs-websocket-js'

export type ModuleConfig = {
	host: string
	port: number
	scheme?: OBSConnectionScheme
}

export type ModuleSecrets = {
	pass?: string
}

/**
 * The pre-4.0.0 config layout, where the WebSocket password lived in `config` rather than `secrets`.
 * Only the v4_0_0 upgrade script should need this.
 */
export type LegacyModuleConfig = ModuleConfig & { pass?: string }

export const OBS_CONNECTION_SCHEMES = ['ws', 'wss'] as const
export type OBSConnectionScheme = (typeof OBS_CONNECTION_SCHEMES)[number]

export interface ModuleChoice {
	id: string | number
	label: string
}

export enum OBSRecordingState {
	Stopped = 'OBS_WEBSOCKET_OUTPUT_STOPPED',
	Recording = 'OBS_WEBSOCKET_OUTPUT_STARTED',
	Paused = 'OBS_WEBSOCKET_OUTPUT_PAUSED',
	Starting = 'OBS_WEBSOCKET_OUTPUT_STARTING',
	Stopping = 'OBS_WEBSOCKET_OUTPUT_STOPPING',
}

export enum OBSStreamingState {
	OffAir = 'OBS_WEBSOCKET_OUTPUT_STOPPED',
	Streaming = 'OBS_WEBSOCKET_OUTPUT_STARTED',
	Starting = 'OBS_WEBSOCKET_OUTPUT_STARTING',
	Stopping = 'OBS_WEBSOCKET_OUTPUT_STOPPING',
	Reconnecting = 'OBS_WEBSOCKET_OUTPUT_RECONNECTING',
	Reconnected = 'OBS_WEBSOCKET_OUTPUT_RECONNECTED',
}

export enum OBSMediaStatus {
	Stopped = 'OBS_MEDIA_STATE_STOPPED',
	Playing = 'OBS_MEDIA_STATE_PLAYING',
	Paused = 'OBS_MEDIA_STATE_PAUSED',
	Ended = 'OBS_MEDIA_STATE_ENDED',
	Error = 'OBS_MEDIA_STATE_ERROR',
	Buffering = 'OBS_MEDIA_STATE_BUFFERING',
	Unknown = 'OBS_MEDIA_STATE_UNKNOWN',
}

export enum OBSOutputState {
	Unknown = 'OBS_WEBSOCKET_OUTPUT_UNKNOWN',
	Starting = 'OBS_WEBSOCKET_OUTPUT_STARTING',
	Started = 'OBS_WEBSOCKET_OUTPUT_STARTED',
	Stopping = 'OBS_WEBSOCKET_OUTPUT_STOPPING',
	Stopped = 'OBS_WEBSOCKET_OUTPUT_STOPPED',
	Reconnecting = 'OBS_WEBSOCKET_OUTPUT_RECONNECTING',
	Reconnected = 'OBS_WEBSOCKET_OUTPUT_RECONNECTED',
	Paused = 'OBS_WEBSOCKET_OUTPUT_PAUSED',
	Resumed = 'OBS_WEBSOCKET_OUTPUT_RESUMED',
}

export enum OBSMediaInputAction {
	None = 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_NONE',
	Play = 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY',
	Pause = 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE',
	Stop = 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP',
	Restart = 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART',
	Next = 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_NEXT',
	Previous = 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PREVIOUS',
}

/**
 * The media_control choices that map straight onto an OBS media action. `toggle` is deliberately
 * absent: it resolves to Play or Pause from the source's current status.
 */
export const MEDIA_CONTROL_ACTIONS = {
	play: OBSMediaInputAction.Play,
	pause: OBSMediaInputAction.Pause,
	restart: OBSMediaInputAction.Restart,
	stop: OBSMediaInputAction.Stop,
	next: OBSMediaInputAction.Next,
	previous: OBSMediaInputAction.Previous,
} as const satisfies Record<string, OBSMediaInputAction>

export type MediaControlAction = keyof typeof MEDIA_CONTROL_ACTIONS

export enum ObsAudioMonitorType {
	None = 'OBS_MONITORING_TYPE_NONE',
	MonitorOnly = 'OBS_MONITORING_TYPE_MONITOR_ONLY',
	MonitorAndOutput = 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT',
}

export interface OBSNormalizedState {
	// Hot state
	streaming: boolean
	streamReconnecting: boolean
	recording: OBSRecordingState
	replayBuffer: boolean
	studioMode: boolean
	programScene: string
	programSceneUuid: string
	previewScene: string
	previewSceneUuid: string
	previousScene: string
	previousSceneUuid: string
	currentTransition: string
	transitionDuration: number
	transitionActive: boolean
	currentSceneCollection: string
	currentProfile: string
	sceneCollectionChanging: boolean
	congestion: number
	streamCongestion: number
	averageFrameTime: number
	fps: number
	renderMissedFrames: number
	renderTotalFrames: number
	outputSkippedFrames: number
	outputTotalFrames: number
	availableDiskSpace: number
	version: OBSVersion | null
	stats: OBSStats | null
	resolution: string
	outputResolution: string
	framerate: string
	outputBytes: number
	streamingTimecode: string
	recordingTimecode: string
	recordDirectory: string
	previewSceneIndex: number | undefined
	vendorEvent: Record<string, unknown>
	currentMedia: string
	custom_command_request: string
	custom_command_response: string

	// Entities
	sources: Map<string, OBSSource> // Keyed by sourceUuid
	scenes: Map<string, OBSScene> // Keyed by sceneUuid
	outputs: Map<string, OBSOutput>
	transitions: Map<string, OBSTransition>
	profiles: Map<string, Record<string, unknown>>
	sceneCollections: Map<string, Record<string, unknown>>
	// Keyed by container (scene or group) UUID.
	sceneItems: Map<string, OBSSceneItem[]>
	// Keyed by input kind; value is that kind's default input settings.
	inputKindList: Map<string, JsonObject>
	sourceFilters: Map<string, OBSFilter[]> // Keyed by sourceUuid or sceneUuid
	monitors: ModuleChoice[]
	imageFormats: ModuleChoice[]
	hotkeyNames: ModuleChoice[]
}

export interface OBSSource {
	active?: boolean
	videoShowing?: boolean
	inputMuted?: boolean
	inputVolume?: number
	inputAudioBalance?: number
	inputAudioSyncOffset?: number
	monitorType?: ObsAudioMonitorType | string
	validName: string
	sourceName: string
	sourceUuid: string
	isGroup?: boolean
	inputKind?: string
	// Parent group UUID if this source is in a group.
	parentGroupUuid?: string
	// Settings arrive verbatim from OBS over the wire, so they are JSON by construction.
	settings?: JsonObject
	OBSMediaStatus?: OBSMediaStatus
	mediaCursor?: number
	mediaDuration?: number
	timeElapsed?: string
	timeRemaining?: string
	text?: string
	imageFile?: string
	inputAudioTracks?: Record<string, unknown>
	peak?: number
}

export type OBSBatchRequest = {
	requestType: string
	requestData?: Record<string, unknown>
	requestId?: string
}

export type OBSRequestStatus = {
	result: boolean
	code: number
	comment?: string
}

/**
 * One entry in a `callBatch` reply.
 *
 * `TResponseData` is supplied by the caller because the payload shape depends entirely on which
 * `requestType` was batched; obs-websocket-js cannot express that correlation across a
 * heterogeneous batch. Callers narrow it at the point where they know what they asked for.
 */
export type OBSBatchResponse<TResponseData = Record<string, unknown>> = {
	requestType: string
	requestId: string
	requestStatus: OBSRequestStatus
	responseData?: TResponseData
}

/** Response payloads for the specific batches this module issues. */
export type OBSInputDefaultSettingsPayload = { defaultInputSettings: JsonObject }
export type OBSSourceFilterListPayload = { filters?: OBSFilter[] }
export type OBSSceneItemListPayload = { sceneItems: OBSSceneItem[] }
export type OBSMediaInputStatusPayload = {
	mediaState?: OBSMediaStatus
	mediaCursor?: number | null
	mediaDuration?: number | null
}

export type OBSInputListEntry = {
	inputUuid: string
	inputName: string
	inputKind?: string
}

/**
 * The per-source data the module fetches in one batch. Modelling it as a map lets the response
 * handler switch on the entry kind and get the matching payload type, instead of treating every
 * payload as `any`.
 */
export type SourceDataPayloads = {
	active: { videoActive?: boolean; videoShowing?: boolean }
	filters: { filters?: OBSFilter[] }
	settings: { inputKind?: string; inputSettings: JsonObject }
	mute: { inputMuted: boolean }
	volume: { inputVolumeDb: number }
	balance: { inputAudioBalance: number }
	sync_offset: { inputAudioSyncOffset: number }
	monitor: { monitorType: ObsAudioMonitorType }
	tracks: { inputAudioTracks: Record<string, unknown> }
}

export type SourceDataKind = keyof SourceDataPayloads

/** Batch spec for the per-source data fetch; every entry carries the source it was issued for. */
export type SourceDataBatchSpec = {
	[K in SourceDataKind]: { meta: { uuid: string }; payload: SourceDataPayloads[K] }
}

export type InputKindDefaultsBatchSpec = {
	defaults: { meta: { inputKind: string }; payload: OBSInputDefaultSettingsPayload }
}

export type OutputStatusBatchSpec = {
	status: { meta: { outputName: string }; payload: OBSOutput }
}

export type SceneFilterBatchSpec = {
	filters: { meta: { sceneUuid: string }; payload: OBSSourceFilterListPayload }
}

export type ContainerItemsBatchSpec = {
	items: { meta: { containerUuid: string }; payload: OBSSceneItemListPayload }
}

export type MediaStatusBatchSpec = {
	status: { meta: { sourceUuid: string }; payload: OBSMediaInputStatusPayload }
}

/** The nested `font` object carried by OBS text source settings. */
export type OBSTextSourceFont = {
	face?: string
	size?: number
	style?: string
	flags?: number
}

/** Payload of the high-frequency `InputVolumeMeters` event. */
export type OBSVolumeMetersEvent = {
	inputs: Array<{ inputUuid: string; inputLevelsMul: Array<[number, number, number]> }>
}

/** `SceneItemListReindexed` sends only the ordering fields, not full scene items. */
export type OBSReindexedSceneItem = {
	sceneItemId: number
	sceneItemIndex: number
}

export type OBSMonitorListEntry = {
	monitorIndex: number
	monitorName?: string
	monitorWidth: number
	monitorHeight: number
}

export interface OBSScene {
	sceneName: string
	sceneUuid: string
	sceneIndex: number
}

export interface OBSOutput {
	outputActive: boolean
	outputName: string
	outputSettings?: Record<string, unknown>
	[key: string]: unknown
}

export interface OBSSceneItem {
	sceneItemId: number
	sourceName: string
	sourceUuid: string
	sceneItemIndex: number
	sceneItemLocked: boolean
	sceneItemEnabled: boolean
	isGroup: boolean
	inputKind: string | null
	sourceType: string
	[key: string]: unknown
}

export interface OBSTransition {
	transitionName: string
	transitionUuid: string
	transitionType: string
	transitionFixed: boolean
	transitionConfigurable: boolean
	transitionFixedDuration?: number
}

export interface OBSFilter {
	filterName: string
	filterEnabled: boolean
	filterIndex: number
	filterKind: string
	filterSettings: Record<string, unknown>
}

export interface OBSVersion {
	obsVersion: string
	obsWebSocketVersion: string
	rpcVersion: number
	availableRequests: string[]
	supportedImageFormats: string[]
	platform: string
	platformDescription: string
}

/**
 * Derived from the protocol definition rather than hand-written.
 *
 * The previous hand-written interface declared `webSocketSessionMessagesReceived`/`Sent` and
 * `webSocketSessionDataReceived`/`Sent`, none of which OBS actually sends — the real fields are
 * `webSocketSessionIncomingMessages`/`OutgoingMessages`. Aliasing the library type keeps this
 * correct as the protocol evolves.
 */
export type OBSStats = OBSResponseTypes['GetStats']
