import { ModuleChoice, OBSNormalizedState, OBSRecordingState, OBSSceneItem, OBSSource, OBSScene } from './types.js'
import {
	INPUT_KIND_IMAGE_SOURCE,
	VIRTUALCAM_OUTPUT_NAME,
	isMediaInputKind,
	isSelectableOutput,
	isTextInputKind,
} from './constants.js'

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

/** A scene item together with the container (scene or group) it was found in. */
export interface SceneItemMatch {
	containerUuid: string
	item: OBSSceneItem
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
			streamCongestion: 0,
			version: null,
			stats: null,
			resolution: '',
			outputResolution: '',
			framerate: '',
			outputBytes: 0,
			recordDirectory: '',
			vendorEvent: {},
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
				(name) => ({ id: name, label: name === VIRTUALCAM_OUTPUT_NAME ? 'Virtual Cam' : name }),
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

	/**
	 * Every scene item representing `sourceUuid` within `sceneUuid`, and the container holding them.
	 *
	 * A source can sit directly in one scene and inside a group in another, so the targeted scene's own
	 * items win; the parent group is consulted only when the scene does not hold the source itself.
	 * Every caller that asks "which items is this source, here" goes through this, so the precedence is
	 * decided once rather than re-derived per call site.
	 *
	 * OBS allows the same source to be added to one scene repeatedly, so a name resolves to a list:
	 * acting on only the first copy leaves the others stranded and out of sync.
	 */
	public findSceneItems(sceneUuid: string, sourceUuid: string): SceneItemMatch[] {
		const parentGroupUuid = this.state.sources.get(sourceUuid)?.parentGroupUuid
		for (const containerUuid of [sceneUuid, parentGroupUuid]) {
			if (!containerUuid) continue
			const items = this.state.sceneItems.get(containerUuid)?.filter((i) => i.sourceUuid === sourceUuid) ?? []
			if (items.length > 0) return items.map((item) => ({ containerUuid, item }))
		}
		return []
	}

	/** The single-item form, for callers such as `learn` that can only work from one item. */
	public findSceneItem(sceneUuid: string, sourceUuid: string): SceneItemMatch | undefined {
		return this.findSceneItems(sceneUuid, sourceUuid)[0]
	}

	/** Name-based form for the action and feedback layers, which work in user-facing names. */
	public findSceneItemsByNameInScene(sceneName: string, sourceName: string): SceneItemMatch[] {
		const scene = this.findSceneByName(sceneName)
		const source = this.findSourceByName(sourceName)
		if (!scene || !source) return []
		return this.findSceneItems(scene.sceneUuid, source.sourceUuid)
	}

	public findSceneItemByName(sceneName: string, sourceName: string): SceneItemMatch | undefined {
		return this.findSceneItemsByNameInScene(sceneName, sourceName)[0]
	}

	/** Every item for a source across all containers; scenes and groups share the one map. */
	public findSceneItemsAnywhere(sourceUuid: string): SceneItemMatch[] {
		const matches: SceneItemMatch[] = []
		for (const [containerUuid, items] of this.state.sceneItems) {
			for (const item of items) {
				if (item.sourceUuid === sourceUuid) matches.push({ containerUuid, item })
			}
		}
		return matches
	}

	// Items of a container (scene or group) by UUID (shared map).
	public getContainerItems(containerUuid: string | undefined): import('./types.js').OBSSceneItem[] | undefined {
		if (!containerUuid) return undefined
		return this.state.sceneItems.get(containerUuid)
	}

	/**
	 * Every item of a container, each paired with the container that actually holds it, optionally
	 * descending into groups. Group items themselves are always included: hiding a group hides its
	 * contents, so both the group and its members have to be addressable.
	 */
	public getContainerItemsDeep(containerUuid: string, includeGroupChildren: boolean): SceneItemMatch[] {
		const matches: SceneItemMatch[] = []
		const seen = new Set<string>()

		const walk = (uuid: string) => {
			if (seen.has(uuid)) return
			seen.add(uuid)
			for (const item of this.state.sceneItems.get(uuid) ?? []) {
				matches.push({ containerUuid: uuid, item })
				if (item.isGroup && includeGroupChildren) walk(item.sourceUuid)
			}
		}
		walk(containerUuid)

		return matches
	}
}
