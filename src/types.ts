export interface ModuleConfig {
	host: string
	port: number
	pass: string
}

export interface Choice {
	id: string | number
	label: string
}

export interface OBSNormalizedState {
	// Hot state
	streaming: boolean
	recording: string
	replayBuffer: boolean
	studioMode: boolean
	programScene: string
	previewScene: string
	previousScene: string
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
	version: any
	stats: any
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
	sources: Map<string, OBSSource>
	scenes: Map<string, OBSScene>
	outputs: Map<string, OBSOutput>
	transitions: Map<string, any>
	profiles: Map<string, any>
	sceneCollections: Map<string, any>
	sceneItems: Map<string, any[]>
	groups: Map<string, any[]>
	inputKindList: Map<string, any>
	mediaSources: Map<string, any>
	imageSources: Map<string, any>
	textSources: Map<string, any>
	sourceFilters: Map<string, any[]>
	audioPeak: Map<string, number>
	monitors: any[]
	imageFormats: any[]
	hotkeyNames: any[]
}

export interface OBSSource {
	active?: boolean
	videoShowing?: boolean
	inputMuted?: boolean
	inputVolume?: number
	inputAudioBalance?: number
	inputAudioSyncOffset?: number
	monitorType?: string
	validName?: string
	sourceName: string
	[key: string]: any
}

export interface OBSScene {
	sceneName: string
	sceneIndex: number
}

export interface OBSOutput {
	outputActive: boolean
	[key: string]: any
}
