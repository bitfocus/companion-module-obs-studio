import { Choice, OBSNormalizedState } from './types.js'

export class OBSState {
	public readonly state: OBSNormalizedState

	constructor() {
		this.state = {
			streaming: false,
			recording: 'Stopped',
			replayBuffer: false,
			studioMode: false,
			programScene: '',
			previewScene: '',
			previousScene: '',
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
			mediaSources: new Map(),
			imageSources: new Map(),
			textSources: new Map(),
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
		this.state.mediaSources.clear()
		this.state.imageSources.clear()
		this.state.textSources.clear()
		this.state.sourceFilters.clear()
		this.state.groups.clear()
	}

	// Derived Choices
	public get sceneChoices(): Choice[] {
		return Array.from(this.state.scenes.values())
			.map((s) => ({ id: s.sceneName, label: s.sceneName }))
			.sort((a, b) => a.label.localeCompare(b.label))
	}

	public get sourceChoices(): Choice[] {
		return Array.from(this.state.sources.values())
			.map((s) => ({ id: s.sourceName, label: s.sourceName }))
			.sort((a, b) => a.label.localeCompare(b.label))
	}

	public get audioSourceList(): Choice[] {
		return Array.from(this.state.sources.values())
			.filter((s) => s.inputMuted !== undefined || s.inputVolume !== undefined)
			.map((s) => ({ id: s.sourceName, label: s.sourceName }))
			.sort((a, b) => a.label.localeCompare(b.label))
	}

	public get mediaSourceList(): Choice[] {
		return Array.from(this.state.mediaSources.keys())
			.map((name) => ({ id: name, label: name }))
			.sort((a, b) => a.label.localeCompare(b.label))
	}

	public get filterList(): Choice[] {
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

	public get textSourceList(): Choice[] {
		return Array.from(this.state.textSources.keys())
			.map((name) => ({ id: name, label: name }))
			.sort((a, b) => a.label.localeCompare(b.label))
	}

	public get imageSourceList(): Choice[] {
		return Array.from(this.state.imageSources.keys())
			.map((name) => ({ id: name, label: name }))
			.sort((a, b) => a.label.localeCompare(b.label))
	}

	public get transitionList(): Choice[] {
		return Array.from(this.state.transitions.keys())
			.map((name) => ({ id: name, label: name }))
			.sort((a, b) => a.label.localeCompare(b.label))
	}

	public get profileChoices(): Choice[] {
		return Array.from(this.state.profiles.keys())
			.map((name) => ({ id: name, label: name }))
			.sort((a, b) => a.label.localeCompare(b.label))
	}

	public get sceneCollectionList(): Choice[] {
		return Array.from(this.state.sceneCollections.keys())
			.map((name) => ({ id: name, label: name }))
			.sort((a, b) => a.label.localeCompare(b.label))
	}

	public get outputList(): Choice[] {
		return Array.from(this.state.outputs.keys())
			.map((name) => ({ id: name, label: name }))
			.sort((a, b) => a.label.localeCompare(b.label))
	}

	// Choice Defaults
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
	public get sceneChoicesProgramPreview(): Choice[] {
		return [
			{ id: 'Current Scene', label: 'Current Scene' },
			{ id: 'Preview Scene', label: 'Preview Scene' },
			...this.sceneChoices,
		]
	}

	public get sceneChoicesAnyScene(): Choice[] {
		return [{ id: 'anyScene', label: '<ANY SCENE>' }, ...this.sceneChoices]
	}

	public get sceneChoicesCustomScene(): Choice[] {
		return [{ id: 'customSceneName', label: '<CUSTOM SCENE NAME>' }, ...this.sceneChoices]
	}

	public get sourceChoicesWithScenes(): Choice[] {
		return [...this.sourceChoices, ...this.sceneChoices]
	}

	public get mediaSourceListCurrentMedia(): Choice[] {
		return [{ id: 'currentMedia', label: '<CURRENT MEDIA>' }, ...this.mediaSourceList]
	}
}
