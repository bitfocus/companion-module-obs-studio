import { ModuleChoice, OBSNormalizedState, OBSRecordingState, OBSSource, OBSScene } from './types.js'
import { INPUT_KIND_IMAGE_SOURCE, isMediaInputKind, isSelectableOutput, isTextInputKind } from './constants.js'

interface ChoiceCache {
	sourceChoices?: ModuleChoice[]
	sceneChoices?: ModuleChoice[]
	audioSourceList?: ModuleChoice[]
	mediaSourceList?: ModuleChoice[]
	filterList?: ModuleChoice[]
	textSourceList?: ModuleChoice[]
	imageSourceList?: ModuleChoice[]
	transitionList?: ModuleChoice[]
	profileChoices?: ModuleChoice[]
	sceneCollectionList?: ModuleChoice[]
	outputList?: ModuleChoice[]
}

export class OBSState {
	public readonly state: OBSNormalizedState

	// Cache active during synchronous rebuilds to memoize choice list calculations.
	private cacheActive = false
	private cache: ChoiceCache = {}

	// Persistent name-to-object indexes for O(1) event handler lookups.
	private sourceNameIndex?: Map<string, OBSSource>
	private sceneNameIndex?: Map<string, OBSScene>

	// Persistent membership list for the media-status poll, so it isn't recomputed every tick.
	private mediaSourceUuidCache?: string[]

	// Generation counter to detect and discard stale in-flight async responses.
	private stateEpoch = 0

	public get epoch(): number {
		return this.stateEpoch
	}

	public invalidateSourceNameIndex(): void {
		this.sourceNameIndex = undefined
		// Kind (and so media-list membership) is only set on creation/removal, but this cache is
		// cheap to rebuild, so piggyback on the same invalidation points rather than tracking separately.
		this.mediaSourceUuidCache = undefined
	}

	// UUIDs of media (ffmpeg/vlc) inputs, for polling GetMediaInputStatus without a per-tick scan.
	public get mediaSourceUuids(): string[] {
		if (!this.mediaSourceUuidCache) {
			this.mediaSourceUuidCache = Array.from(this.state.sources.values())
				.filter((s) => isMediaInputKind(s.inputKind))
				.map((s) => s.sourceUuid)
		}
		return this.mediaSourceUuidCache
	}

	public invalidateSceneNameIndex(): void {
		this.sceneNameIndex = undefined
	}

	public beginCache(): void {
		this.cacheActive = true
		this.cache = {}
	}

	public endCache(): void {
		this.cacheActive = false
		this.cache = {}
	}

	private cached<K extends keyof ChoiceCache>(
		key: K,
		compute: () => NonNullable<ChoiceCache[K]>,
	): NonNullable<ChoiceCache[K]> {
		if (this.cacheActive) {
			const existing = this.cache[key]
			if (existing !== undefined) return existing
			const value = compute()
			this.cache[key] = value
			return value
		}
		return compute()
	}

	constructor() {
		this.state = {
			streaming: false,
			streamReconnecting: false,
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
			inputKindList: new Map(),
			sourceFilters: new Map(),
			audioPeak: new Map(),
			monitors: [],
			imageFormats: [],
			hotkeyNames: [],
		}
	}

	public resetSceneSourceStates(): void {
		this.stateEpoch++
		this.state.scenes.clear()
		this.state.sources.clear()
		this.state.sourceFilters.clear()
		this.state.sceneItems.clear()
		this.state.audioPeak.clear()
		this.invalidateSourceNameIndex()
		this.invalidateSceneNameIndex()
	}

	// Helper to filter, map, and sort choice lists.
	private buildChoices<T>(
		items: T[],
		filterFn: (item: T) => boolean,
		mapFn: (item: T) => ModuleChoice,
		sortFn?: (a: ModuleChoice, b: ModuleChoice) => number,
	): ModuleChoice[] {
		let result = items.filter(filterFn).map(mapFn)
		if (sortFn) {
			result = result.sort(sortFn)
		}
		return result
	}

	// Derived Choices
	public get sceneChoices(): ModuleChoice[] {
		return this.cached('sceneChoices', () =>
			Array.from(this.state.scenes.values())
				.map((s) => ({ id: s.sceneName, label: s.sceneName }))
				.reverse(),
		)
	}

	public get sourceChoices(): ModuleChoice[] {
		return this.cached('sourceChoices', () =>
			this.buildChoices(
				Array.from(this.state.sources.values()),
				() => true,
				(s) => ({ id: s.sourceName, label: s.sourceName }),
				(a, b) => a.label.localeCompare(b.label),
			),
		)
	}

	public get audioSourceList(): ModuleChoice[] {
		return this.cached('audioSourceList', () =>
			this.buildChoices(
				Array.from(this.state.sources.values()),
				(s) => s.inputMuted !== undefined || s.inputVolume !== undefined,
				(s) => ({ id: s.sourceName, label: s.sourceName }),
				(a, b) => a.label.localeCompare(b.label),
			),
		)
	}

	public get mediaSourceList(): ModuleChoice[] {
		return this.cached('mediaSourceList', () =>
			this.buildChoices(
				Array.from(this.state.sources.values()),
				(s) => isMediaInputKind(s.inputKind),
				(s) => ({ id: s.sourceName, label: s.sourceName }),
				(a, b) => a.label.localeCompare(b.label),
			),
		)
	}

	public get filterList(): ModuleChoice[] {
		return this.cached('filterList', () => {
			const filters = new Set<string>()
			for (const sourceFilters of this.state.sourceFilters.values()) {
				for (const filter of sourceFilters) {
					filters.add(filter.filterName)
				}
			}
			return this.buildChoices(
				Array.from(filters),
				() => true,
				(name) => ({ id: name, label: name }),
				(a, b) => a.label.localeCompare(b.label),
			)
		})
	}

	public get textSourceList(): ModuleChoice[] {
		return this.cached('textSourceList', () =>
			this.buildChoices(
				Array.from(this.state.sources.values()),
				(s) => isTextInputKind(s.inputKind),
				(s) => ({ id: s.sourceName, label: s.sourceName }),
				(a, b) => a.label.localeCompare(b.label),
			),
		)
	}

	public get imageSourceList(): ModuleChoice[] {
		return this.cached('imageSourceList', () =>
			this.buildChoices(
				Array.from(this.state.sources.values()),
				(s) => s.inputKind === INPUT_KIND_IMAGE_SOURCE,
				(s) => ({ id: s.sourceName, label: s.sourceName }),
				(a, b) => a.label.localeCompare(b.label),
			),
		)
	}

	public get transitionList(): ModuleChoice[] {
		return this.cached('transitionList', () =>
			this.buildChoices(
				Array.from(this.state.transitions.values()),
				() => true,
				(t) => ({ id: t.transitionName, label: t.transitionName }),
				(a, b) => a.label.localeCompare(b.label),
			),
		)
	}

	public get profileChoices(): ModuleChoice[] {
		return this.cached('profileChoices', () =>
			this.buildChoices(
				Array.from(this.state.profiles.keys()),
				() => true,
				(name) => ({ id: name, label: name }),
				(a, b) => a.label.localeCompare(b.label),
			),
		)
	}

	public get sceneCollectionList(): ModuleChoice[] {
		return this.cached('sceneCollectionList', () =>
			this.buildChoices(
				Array.from(this.state.sceneCollections.keys()),
				() => true,
				(name) => ({ id: name, label: name }),
				(a, b) => a.label.localeCompare(b.label),
			),
		)
	}

	public get outputList(): ModuleChoice[] {
		return this.cached('outputList', () =>
			this.buildChoices(
				Array.from(this.state.outputs.keys()),
				(id) => isSelectableOutput(id),
				(name) => ({ id: name, label: name === 'virtualcam_output' ? 'Virtual Cam' : name }),
				(a, b) => a.label.localeCompare(b.label),
			),
		)
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

	// Name-based lookup helpers
	public findSourceByName(name: string): OBSSource | undefined {
		if (!this.sourceNameIndex) {
			const index = new Map<string, OBSSource>()
			for (const source of this.state.sources.values()) index.set(source.sourceName, source)
			this.sourceNameIndex = index
		}
		return this.sourceNameIndex.get(name)
	}

	public findSceneByName(name: string): OBSScene | undefined {
		if (!this.sceneNameIndex) {
			const index = new Map<string, OBSScene>()
			for (const scene of this.state.scenes.values()) index.set(scene.sceneName, scene)
			this.sceneNameIndex = index
		}
		return this.sceneNameIndex.get(name)
	}

	/** OBS orders scenes bottom-up, so a lower sceneIndex is the "next" scene in the UI. */
	public findSceneByIndex(index: number): OBSScene | undefined {
		for (const scene of this.state.scenes.values()) {
			if (scene.sceneIndex === index) return scene
		}
		return undefined
	}

	// Filters attach to inputs or scenes, so resolve against both maps.
	public findFilterTargetUuid(name: string): string | undefined {
		return this.findSourceByName(name)?.sourceUuid ?? this.findSceneByName(name)?.sceneUuid
	}

	public findSourceFiltersByName(sourceName: string): import('./types.js').OBSFilter[] | undefined {
		const uuid = this.findFilterTargetUuid(sourceName)
		if (uuid) return this.state.sourceFilters.get(uuid)
		return undefined
	}

	public findSceneItemsByName(sceneName: string): import('./types.js').OBSSceneItem[] | undefined {
		const scene = this.findSceneByName(sceneName)
		if (scene) return this.state.sceneItems.get(scene.sceneUuid)
		return undefined
	}

	// Items of a container (scene or group) by UUID (shared map).
	public getContainerItems(containerUuid: string | undefined): import('./types.js').OBSSceneItem[] | undefined {
		if (!containerUuid) return undefined
		return this.state.sceneItems.get(containerUuid)
	}
}
