export interface ModuleConfig {
	host: string
	port: number
	pass: string
}

export interface OBSState {
	currentSceneCollection?: string
	currentProfile?: string
	programScene?: string
	previewScene?: string
	previousScene?: string
	sceneCollectionChanging?: boolean
	streaming?: boolean
	recording?: string
	replayBuffer?: boolean
	studioMode?: boolean
	currentTransition?: string
	transitionDuration?: number
	transitionActive?: boolean
	currentMedia?: string
	[key: string]: any
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
