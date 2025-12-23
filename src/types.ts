export interface ModuleConfig {
	host: string
	port: number
}

export interface ModuleSecrets {
	pass: string
}

export interface Choice {
	id: string | number
	label: string
}

export enum RecordingState {
	Stopped = 'OBS_WEBSOCKET_OUTPUT_STOPPED',
	Recording = 'OBS_WEBSOCKET_OUTPUT_STARTED',
	Paused = 'OBS_WEBSOCKET_OUTPUT_PAUSED',
	Starting = 'OBS_WEBSOCKET_OUTPUT_STARTING',
	Stopping = 'OBS_WEBSOCKET_OUTPUT_STOPPING',
}

export enum StreamingState {
	OffAir = 'OBS_WEBSOCKET_OUTPUT_STOPPED',
	Streaming = 'OBS_WEBSOCKET_OUTPUT_STARTED',
	Starting = 'OBS_WEBSOCKET_OUTPUT_STARTING',
	Stopping = 'OBS_WEBSOCKET_OUTPUT_STOPPING',
}

export enum MediaStatus {
	Stopped = 'OBS_MEDIA_STATE_STOPPED',
	Playing = 'OBS_MEDIA_STATE_PLAYING',
	Paused = 'OBS_MEDIA_STATE_PAUSED',
	Ended = 'OBS_MEDIA_STATE_ENDED',
	Error = 'OBS_MEDIA_STATE_ERROR',
	Buffering = 'OBS_MEDIA_STATE_BUFFERING',
	Unknown = 'OBS_MEDIA_STATE_UNKNOWN',
}

export enum ObsOutputState {
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

export enum ObsMediaInputAction {
	None = 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_NONE',
	Play = 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY',
	Pause = 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE',
	Stop = 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP',
	Restart = 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART',
	Next = 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_NEXT',
	Previous = 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PREVIOUS',
}

export enum ObsAudioMonitorType {
	None = 'OBS_MONITORING_TYPE_NONE',
	MonitorOnly = 'OBS_MONITORING_TYPE_MONITOR_ONLY',
	MonitorAndOutput = 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT',
}

export interface OBSNormalizedState {
	// Hot state
	streaming: boolean
	recording: RecordingState
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
	vendorEvent: any
	currentMedia: string
	custom_command_request: string
	custom_command_response: string

	// Entities
	sources: Map<string, OBSSource> // Keyed by sourceUuid
	scenes: Map<string, OBSScene> // Keyed by sceneUuid
	outputs: Map<string, OBSOutput>
	transitions: Map<string, OBSTransition>
	profiles: Map<string, any>
	sceneCollections: Map<string, any>
	sceneItems: Map<string, OBSSceneItem[]> // Keyed by sceneUuid
	groups: Map<string, OBSSceneItem[]> // Keyed by groupUuid
	inputKindList: Map<string, any>
	sourceFilters: Map<string, OBSFilter[]> // Keyed by sourceUuid
	audioPeak: Map<string, number>
	monitors: Choice[]
	imageFormats: Choice[]
	hotkeyNames: Choice[]
}

export interface OBSSource {
	active?: boolean
	videoShowing?: boolean
	inputMuted?: boolean
	inputVolume?: number
	inputAudioBalance?: number
	inputAudioSyncOffset?: number
	monitorType?: ObsAudioMonitorType
	validName?: string
	sourceName: string
	sourceUuid: string
	isGroup?: boolean
	inputKind?: string
	groupedSource?: boolean
	groupName?: string
	settings?: any
	mediaStatus?: MediaStatus
	mediaCursor?: number
	mediaDuration?: number
	timeElapsed?: string
	timeRemaining?: string
	text?: string
	imageFile?: string
	inputAudioTracks?: any
	[key: string]: any
}

export interface OBSScene {
	sceneName: string
	sceneUuid: string
	sceneIndex: number
}

export interface OBSOutput {
	outputActive: boolean
	[key: string]: any
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
	[key: string]: any
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
	filterSettings: any
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

export interface OBSStats {
	cpuUsage: number
	memoryUsage: number
	availableDiskSpace: number
	activeFps: number
	averageFrameRenderTime: number
	renderSkippedFrames: number
	renderTotalFrames: number
	outputSkippedFrames: number
	outputTotalFrames: number
	webSocketSessionMessagesReceived: number
	webSocketSessionMessagesSent: number
	webSocketSessionDataReceived: number
	webSocketSessionDataSent: number
}
