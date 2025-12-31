import { ModuleChoice, OBSNormalizedState, OBSRecordingState } from './types.js'

export class OBSState {
	public readonly state: OBSNormalizedState

	constructor() {
		this.state = {
			streaming: false,
			recording: OBSRecordingState.Stopped,
			replayBuffer: false,
			studioMode: false,
			programScene: '',
			programSceneUuid: '',
			previewScene: '',
			previewSceneUuid: '',
			previousScene: '',
			previousSceneUuid: '',
			currentTransition: '',
			transitionDuration: 0,
			transitionActive: false,
			currentSceneCollection: '',
			currentProfile: '',
			sceneCollectionChanging: false,
			congestion: 0,
			streamCongestion: 0,
			averageFrameTime: 0,
			fps: 0,
			renderMissedFrames: 0,
			renderTotalFrames: 0,
			outputSkippedFrames: 0,
			outputTotalFrames: 0,
			availableDiskSpace: 0,
			version: null,
			stats: null,
			resolution: '',
			outputResolution: '',
			framerate: '',
			outputBytes: 0,
			streamingTimecode: '00:00:00',
			recordingTimecode: '00:00:00',
			recordDirectory: '',
			previewSceneIndex: undefined,
			vendorEvent: {},
			currentMedia: '',
			custom_command_request: '',
			custom_command_response: '',

			sources: new Map(),
			scenes: new Map(),
			outputs: new Map(),
			transitions: new Map(),
			profiles: new Map(),
			sceneCollections: new Map(),
			sceneItems: new Map(),
			groups: new Map(),
			inputKindList: new Map(),
			sourceFilters: new Map(),
			audioPeak: new Map(),
			monitors: [],
			imageFormats: [],
			hotkeyNames: [],
		}
	}

	public resetSceneSourceStates(): void {
		this.state.scenes.clear()
		this.state.sources.clear()
		this.state.sourceFilters.clear()
		this.state.groups.clear()
		this.state.sceneItems.clear()
	}

	// Derived Choices
	public get sceneChoices(): ModuleChoice[] {
		return Array.from(this.state.scenes.values())
			.map((s) => ({ id: s.sceneUuid, label: s.sceneName }))
			.reverse()
	}

	public get sourceChoices(): ModuleChoice[] {
		return Array.from(this.state.sources.values())
			.map((s) => ({ id: s.sourceUuid, label: s.sourceName }))
			.sort((a, b) => a.label.localeCompare(b.label))
	}

	public get audioSourceList(): ModuleChoice[] {
		return Array.from(this.state.sources.values())
			.filter((s) => s.inputMuted !== undefined || s.inputVolume !== undefined)
			.map((s) => ({ id: s.sourceUuid, label: s.sourceName }))
			.sort((a, b) => a.label.localeCompare(b.label))
	}

	public get mediaSourceList(): ModuleChoice[] {
		return Array.from(this.state.sources.values())
			.filter((s) => s.inputKind === 'ffmpeg_source' || s.inputKind === 'vlc_source')
			.map((s) => ({ id: s.sourceUuid, label: s.sourceName }))
			.sort((a, b) => a.label.localeCompare(b.label))
	}

	public get filterList(): ModuleChoice[] {
		const filters = new Set<string>()
		for (const sourceFilters of this.state.sourceFilters.values()) {
			for (const filter of sourceFilters) {
				filters.add(filter.filterName)
			}
		}
		return Array.from(filters)
			.map((name) => ({ id: name, label: name }))
			.sort((a, b) => a.label.localeCompare(b.label))
	}

	public get textSourceList(): ModuleChoice[] {
		return Array.from(this.state.sources.values())
			.filter((s) => s.inputKind?.startsWith('text_'))
			.map((s) => ({ id: s.sourceUuid, label: s.sourceName }))
			.sort((a, b) => a.label.localeCompare(b.label))
	}

	public get imageSourceList(): ModuleChoice[] {
		return Array.from(this.state.sources.values())
			.filter((s) => s.inputKind === 'image_source')
			.map((s) => ({ id: s.sourceUuid, label: s.sourceName }))
			.sort((a, b) => a.label.localeCompare(b.label))
	}

	public get transitionList(): ModuleChoice[] {
		return Array.from(this.state.transitions.values())
			.map((t) => ({ id: t.transitionName, label: t.transitionName }))
			.sort((a, b) => a.label.localeCompare(b.label))
	}

	public get profileChoices(): ModuleChoice[] {
		return Array.from(this.state.profiles.keys())
			.map((name) => ({ id: name, label: name }))
			.sort((a, b) => a.label.localeCompare(b.label))
	}

	public get sceneCollectionList(): ModuleChoice[] {
		return Array.from(this.state.sceneCollections.keys())
			.map((name) => ({ id: name, label: name }))
			.sort((a, b) => a.label.localeCompare(b.label))
	}

	public get outputList(): ModuleChoice[] {
		return Array.from(this.state.outputs.keys())
			.map((name) => ({ id: name, label: name === 'virtualcam_output' ? 'Virtual Camera' : name }))
			.filter((item) => !item.id.includes('file_output'))
			.filter((item) => !item.id.includes('ffmpeg_output'))
			.sort((a, b) => a.label.localeCompare(b.label))
	}

	// ModuleChoice Defaults
	public get sceneListDefault(): string {
		return (this.sceneChoices[0]?.id as string) ?? ''
	}

	public get sourceListDefault(): string {
		return (this.sourceChoices[0]?.id as string) ?? ''
	}

	public get audioSourceListDefault(): string {
		return (this.audioSourceList[0]?.id as string) ?? ''
	}

	public get filterListDefault(): string {
		return (this.filterList[0]?.id as string) ?? ''
	}

	public get profileChoicesDefault(): string {
		return (this.profileChoices[0]?.id as string) ?? ''
	}

	public get mediaSourceListDefault(): string {
		return (this.mediaSourceList[0]?.id as string) ?? ''
	}

	// Special Choices
	public get sourceChoicesWithScenes(): ModuleChoice[] {
		return [...this.sourceChoices, ...this.sceneChoices]
	}
}
