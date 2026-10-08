import {
	CompanionStaticUpgradeProps,
	CompanionUpgradeContext,
	CompanionStaticUpgradeResult,
	CreateConvertToBooleanFeedbackUpgradeScript,
	CompanionMigrationAction,
	CompanionMigrationFeedback,
	type CompanionMigrationOptionValues,
	type ExpressionOrValue,
	FixupNumericOrVariablesValueToExpressions,
	type JsonValue,
} from '@companion-module/base'
import { LegacyModuleConfig, ModuleConfig, ModuleSecrets } from './types.js'
import { Color } from './utils.js'
import { CONGESTION_MEDIOCRE } from './constants.js'

/**
 * Companion hands upgrade scripts every option wrapped as `{ isExpression, value }`, and stores whatever comes
 * back as-is, so anything written here must use the same shape or Companion reads it as missing.
 */
type OptionValue = ExpressionOrValue<JsonValue | undefined>
type OptionTransform = (opt: OptionValue | undefined) => OptionValue | undefined

function getOpt(options: CompanionMigrationOptionValues, key: string): unknown {
	const opt: unknown = options[key]
	return opt !== null && typeof opt === 'object' && 'value' in opt ? opt.value : opt
}

function setOpt(options: CompanionMigrationOptionValues, key: string, value: unknown): void {
	const opt: unknown = options[key]
	if (opt !== null && typeof opt === 'object' && 'value' in opt) {
		opt.value = value
	} else {
		options[key] = { isExpression: false, value: value as JsonValue | undefined }
	}
}

function renameOpt(options: CompanionMigrationOptionValues, from: string, to: string): void {
	if (!(from in options)) return
	options[to] = options[from]
	delete options[from]
}

/**
 * v3 parsed variables in these fields itself, but v4 dropdowns don't, so a value carrying variables has to
 * become an expression to keep resolving.
 */
const variablesToExpression: OptionTransform = (opt) => {
	if (!opt || opt.isExpression || typeof opt.value !== 'string' || !opt.value.includes('$(')) return opt
	return FixupNumericOrVariablesValueToExpressions(opt)
}

/** The multi-select form of `variablesToExpression`, for a single v3 value moving into a multidropdown. */
const variablesToListExpression: OptionTransform = (opt) => {
	if (opt?.isExpression || Array.isArray(opt?.value)) return opt
	const converted = variablesToExpression(opt)
	if (converted?.isExpression) return { isExpression: true, value: `[${String(converted.value)}]` }
	const value = opt?.value
	return { isExpression: false, value: value === undefined || value === '' ? [] : [value] }
}

function lookupTransform(map: Record<string, JsonValue>): OptionTransform {
	return (opt) => {
		const key = opt?.value
		if (!opt || opt.isExpression || (typeof key !== 'string' && typeof key !== 'boolean') || !(String(key) in map))
			return opt
		return { isExpression: false, value: map[String(key)] }
	}
}

function scaleTransform(factor: number): OptionTransform {
	return (opt) => {
		if (!opt || opt.isExpression || typeof opt.value !== 'number') return opt
		return { isExpression: false, value: opt.value * factor }
	}
}

const PREVIEW_SCENE_EXPRESSION: OptionValue = { isExpression: true, value: '$(obs:scene_preview)' }

/** v3's three monitor choices, mapped onto whether monitoring is enabled. */
const V3_MONITOR_ENABLED: Record<string, boolean> = {
	none: false,
	monitorOnly: true,
	monitorAndOutput: true,
}

/**
 * The monitor option went from three monitor types to a plain enabled/disabled value, matching the OBS 32.1+
 * mixer where monitoring is a single toggle. Both monitoring types become enabled; anything that isn't one of
 * the three v3 choices (an expression, or an already-converted value) is left alone.
 */
function convertMonitorOption(options: CompanionMigrationOptionValues): boolean {
	const monitor = getOpt(options, 'monitor')
	if (typeof monitor !== 'string' || !(monitor in V3_MONITOR_ENABLED)) return false
	setOpt(options, 'monitor', V3_MONITOR_ENABLED[monitor] ? 'true' : 'false')
	return true
}

/**
 * The feedback lost its monitor option entirely and is now simply true while monitoring is enabled, so a
 * feedback that matched "None" has to be inverted to keep meaning the same thing.
 */
function convertMonitorFeedback(feedback: CompanionMigrationFeedback): boolean {
	const monitor = getOpt(feedback.options, 'monitor')
	if (typeof monitor !== 'string' || !(monitor in V3_MONITOR_ENABLED)) return false

	// An inversion driven by an expression can't be flipped statically, so it is left as the user set it.
	if (!V3_MONITOR_ENABLED[monitor] && feedback.isInverted?.isExpression !== true) {
		feedback.isInverted = { isExpression: false, value: feedback.isInverted?.value !== true }
	}
	delete feedback.options.monitor
	return true
}

/**
 * Action families that used to be one action per command (recording start/stop/pause/…), or a
 * set/adjust pair, are now a single action with a leading dropdown. Each entry names the combined
 * action, the fixed option values that identify the old command, any option renames it needs,
 * defaults for options that the old action could leave unset, and transforms (keyed by the new option
 * name, run after renames) for values whose meaning changed.
 */
const ACTION_MIGRATIONS: Record<
	string,
	{
		actionId: string
		options: Record<string, unknown>
		renames?: Record<string, string>
		defaults?: Record<string, unknown>
		transforms?: Record<string, OptionTransform>
	}
> = {
	start_recording: { actionId: 'recording', options: { action: 'start' } },
	stop_recording: { actionId: 'recording', options: { action: 'stop' } },
	pause_recording: { actionId: 'recording', options: { action: 'pause' } },
	resume_recording: { actionId: 'recording', options: { action: 'resume' } },
	ToggleRecordPause: { actionId: 'recording', options: { action: 'toggle_pause' } },
	StartStopRecording: { actionId: 'recording', options: { action: 'toggle' } },
	SplitRecordFile: { actionId: 'recording', options: { action: 'split' } },
	CreateRecordChapter: { actionId: 'recording', options: { action: 'chapter' } },

	start_streaming: { actionId: 'streaming', options: { action: 'start' } },
	stop_streaming: { actionId: 'streaming', options: { action: 'stop' } },
	StartStopStreaming: { actionId: 'streaming', options: { action: 'toggle' } },

	start_replay_buffer: { actionId: 'replay_buffer', options: { action: 'start' } },
	stop_replay_buffer: { actionId: 'replay_buffer', options: { action: 'stop' } },
	save_replay_buffer: { actionId: 'replay_buffer', options: { action: 'save' } },
	ToggleReplayBuffer: { actionId: 'replay_buffer', options: { action: 'toggle' } },

	start_output: { actionId: 'output', options: { action: 'start' } },
	stop_output: { actionId: 'output', options: { action: 'stop' } },
	start_stop_output: { actionId: 'output', options: { action: 'toggle' } },

	enable_studio_mode: { actionId: 'studio_mode', options: { enabled: 'true' } },
	disable_studio_mode: { actionId: 'studio_mode', options: { enabled: 'false' } },
	toggle_studio_mode: { actionId: 'studio_mode', options: { enabled: 'toggle' } },

	toggle_source_mute: { actionId: 'mute', options: { mute: 'toggle' } },
	set_source_mute: { actionId: 'mute', options: {} },

	set_volume: { actionId: 'volume', options: { mode: 'set', unit: 'db', duration: 0 }, renames: { volume: 'value' } },
	fadeVolume: { actionId: 'volume', options: { mode: 'set', unit: 'db' }, renames: { volume: 'value' } },
	adjust_volume: { actionId: 'volume', options: { mode: 'adjust', unit: 'db' }, renames: { volume: 'amount' } },
	adjust_volume_percent: {
		actionId: 'volume',
		options: { mode: 'adjust', unit: 'percent' },
		renames: { percent: 'amount' },
	},

	setSyncOffset: { actionId: 'audio_offset', options: { mode: 'set' }, renames: { offset: 'value' } },
	// The v3 adjust amounts were free text parsed as numbers.
	adjustSyncOffset: {
		actionId: 'audio_offset',
		options: { mode: 'adjust' },
		renames: { offset: 'amount' },
		transforms: { amount: FixupNumericOrVariablesValueToExpressions },
	},
	setAudioBalance: { actionId: 'audio_balance', options: { mode: 'set' }, renames: { balance: 'value' } },
	adjustAudioBalance: {
		actionId: 'audio_balance',
		options: { mode: 'adjust' },
		renames: { offset: 'amount' },
		transforms: { amount: FixupNumericOrVariablesValueToExpressions },
	},

	set_transition: {
		actionId: 'transition_type',
		options: { mode: 'set' },
		transforms: { transitions: variablesToExpression },
	},
	set_transition_duration: {
		actionId: 'transition_duration',
		options: { mode: 'set' },
		renames: { duration: 'value' },
	},
	adjustTransitionDuration: {
		actionId: 'transition_duration',
		options: { mode: 'adjust' },
		renames: { duration: 'amount' },
	},

	preview_scene: { actionId: 'preview_scene', options: { mode: 'set' } },

	// The next/previous dropdown these carried is now one more choice on the combined mode dropdown,
	// so its value moves across rather than being fixed.
	adjustTransitionType: {
		actionId: 'transition_type',
		options: {},
		renames: { adjust: 'mode' },
		defaults: { mode: 'next' },
	},
	adjustPreviewScene: {
		actionId: 'preview_scene',
		options: {},
		renames: { adjust: 'mode' },
		defaults: { mode: 'next' },
	},

	play_pause_media: {
		actionId: 'media_control',
		options: {},
		renames: { playPause: 'action' },
		// v3 named its choices after OBS's pause flag: 'false' played and 'true' paused.
		transforms: { action: lookupTransform({ toggle: 'toggle', false: 'play', true: 'pause' }) },
	},
	restart_media: { actionId: 'media_control', options: { action: 'restart' } },
	stop_media: { actionId: 'media_control', options: { action: 'stop' } },
	next_media: { actionId: 'media_control', options: { action: 'next' } },
	previous_media: { actionId: 'media_control', options: { action: 'previous' } },
	// The v3 timecode was in seconds; the combined action takes milliseconds.
	set_media_time: {
		actionId: 'media_time',
		options: { mode: 'set' },
		renames: { mediaTime: 'value' },
		transforms: { value: scaleTransform(1000) },
	},
	scrub_media: { actionId: 'media_time', options: { mode: 'adjust' }, renames: { scrubAmount: 'amount' } },
	updateMediaLocalFile: { actionId: 'updateMediaLocalFile', options: {}, renames: { mediaFilePath: 'path' } },

	set_stream_settings: {
		actionId: 'set_stream_settings',
		options: {},
		renames: { streamAuth: 'useAuth', streamUserName: 'username', streamPassword: 'password' },
	},
}

const MEDIA_TARGET_ACTIONS = ['media_control', 'media_time', 'updateMediaLocalFile']

/**
 * v3 media actions targeted the last clip that started via the magic source 'currentMedia' (their default);
 * that becomes the explicit "newest playing clip" target, and every other source an explicit source target.
 */
function convertMediaTarget(action: CompanionMigrationAction): boolean {
	if (!MEDIA_TARGET_ACTIONS.includes(action.actionId) || action.options.target !== undefined) return false

	const currentMedia = getOpt(action.options, 'source') === 'currentMedia'
	setOpt(action.options, 'target', currentMedia ? 'newest' : 'source')
	if (currentMedia) setOpt(action.options, 'source', '')
	return true
}

function consolidateAction(action: CompanionMigrationAction): boolean {
	const migration = ACTION_MIGRATIONS[action.actionId]
	if (!migration) return false

	action.actionId = migration.actionId
	for (const [from, to] of Object.entries(migration.renames ?? {})) {
		renameOpt(action.options, from, to)
	}
	for (const [key, value] of Object.entries(migration.options)) {
		setOpt(action.options, key, value)
	}
	for (const [key, value] of Object.entries(migration.defaults ?? {})) {
		if (!(key in action.options)) setOpt(action.options, key, value)
	}
	for (const [key, transform] of Object.entries(migration.transforms ?? {})) {
		if (key in action.options) action.options[key] = transform(action.options[key])
	}
	return true
}

export default [
	CreateConvertToBooleanFeedbackUpgradeScript({
		streaming: true,
		scene_item_active: true,
		profile_active: true,
		scene_collection_active: true,
		scene_item_active_in_scene: true,
		output_active: true,
		transition_active: true,
		current_transition: true,
		transition_duration: true,
		filter_enabled: true,
	}),
	function v2_0_0(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>,
	): CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> {
		const changes: CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}
		if (props.config) {
			const config = props.config
			if (config.port == undefined || config.port === 4444 || !config.port) {
				config.port = 4455
				changes.updatedConfig = config
			}
		}

		for (const action of props.actions) {
			if (action.actionId === 'set-freetype-text' || action.actionId === 'set-gdi-text') {
				action.actionId = 'setText'
				changes.updatedActions.push(action)
			}
			if (action.actionId === 'take_screenshot') {
				setOpt(action.options, 'source', 'programScene')
				setOpt(action.options, 'custom', '')
				changes.updatedActions.push(action)
			}
		}

		return changes
	},
	function v3_1_0(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>,
	): CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> {
		const changes: CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}

		for (const action of props.actions) {
			if (action.actionId === 'quick_transition') {
				if ((getOpt(action.options, 'transition_time') as number) > 0) {
					setOpt(action.options, 'customDuration', true)
				} else {
					setOpt(action.options, 'customDuration', false)
					setOpt(action.options, 'transition_time', 500)
				}
				changes.updatedActions.push(action)
			}
		}

		return changes
	},
	function v3_3_0(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>,
	): CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> {
		const changes: CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}

		for (const action of props.actions) {
			if (action.actionId === 'toggle_filter') {
				setOpt(action.options, 'all', false)
				changes.updatedActions.push(action)
			}
			if (action.actionId === 'toggle_scene_item') {
				if (getOpt(action.options, 'source') === 'allSources') {
					setOpt(action.options, 'all', true)
				} else {
					setOpt(action.options, 'all', false)
				}
				changes.updatedActions.push(action)
			}
		}
		for (const feedback of props.feedbacks) {
			if (feedback.feedbackId === 'scene_item_active_in_scene') {
				if (getOpt(feedback.options, 'source') === 'anySource') {
					setOpt(feedback.options, 'any', true)
				} else {
					setOpt(feedback.options, 'any', false)
				}
				changes.updatedFeedbacks.push(feedback)
			}
		}

		return changes
	},
	function v3_5_0(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>,
	): CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> {
		const changes: CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}

		for (const feedback of props.feedbacks) {
			if (feedback.feedbackId === 'streamCongestion') {
				if (!getOpt(feedback.options, 'colorNoStream')) {
					setOpt(feedback.options, 'colorNoStream', '#464646')
					setOpt(feedback.options, 'colorLow', '#00c800')
					setOpt(feedback.options, 'colorMedium', '#d4ae00')
					setOpt(feedback.options, 'colorHigh', '#c80000')
				}
				changes.updatedFeedbacks.push(feedback)
			}
		}

		return changes
	},
	function v3_7_0(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>,
	): CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> {
		const changes: CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}

		for (const action of props.actions) {
			if (action.actionId === 'set_transition_duration') {
				if (typeof getOpt(action.options, 'duration') === 'number') {
					if ((getOpt(action.options, 'duration') as number) < 50) {
						setOpt(action.options, 'duration', 50)
					}
					if ((getOpt(action.options, 'duration') as number) > 20000) {
						setOpt(action.options, 'duration', 20000)
					}
				}
				setOpt(action.options, 'variableValue', '500')
				setOpt(action.options, 'useVariable', false)
				changes.updatedActions.push(action)
			}
		}

		return changes
	},
	function v3_11_0(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>,
	): CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> {
		const changes: CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}

		for (const feedback of props.feedbacks) {
			if (feedback.feedbackId === 'audioMeter') {
				if (!getOpt(feedback.options, 'threshold')) {
					setOpt(feedback.options, 'threshold', -60)
				}
				changes.updatedFeedbacks.push(feedback)
			}
		}

		return changes
	},
	function v3_12_0(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>,
	): CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> {
		const changes: CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}
		for (const action of props.actions) {
			if (action.actionId === 'take_screenshot') {
				if (!getOpt(action.options, 'customName') && getOpt(action.options, 'path')) {
					setOpt(action.options, 'customName', true)
					setOpt(action.options, 'fileName', '')
				} else if (!getOpt(action.options, 'customName')) {
					setOpt(action.options, 'customName', false)
					setOpt(action.options, 'fileName', '')
				}

				changes.updatedActions.push(action)
			}
		}
		return changes
	},
	function v3_15_0(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>,
	): CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> {
		const changes: CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}
		for (const action of props.actions) {
			if (action.actionId === 'set_stream_settings') {
				if (!getOpt(action.options, 'service')) {
					setOpt(action.options, 'service', 'Twitch')
				}
				if (!getOpt(action.options, 'serviceName')) {
					setOpt(action.options, 'serviceName', 'Twitch')
				}
				if (!getOpt(action.options, 'bearerToken')) {
					setOpt(action.options, 'bearerToken', '')
				}
				changes.updatedActions.push(action)
			}
		}
		return changes
	},
	function v3_16_0(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>,
	): CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> {
		const changes: CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}

		if (props.config && props.config.scheme === undefined) {
			props.config.scheme = 'ws'
			changes.updatedConfig = props.config
		}

		return changes
	},
	function v4_0_0(
		_context: CompanionUpgradeContext<LegacyModuleConfig>,
		props: CompanionStaticUpgradeProps<LegacyModuleConfig, ModuleSecrets>,
	): CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> {
		const changes: CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> = {
			updatedConfig: null,
			updatedSecrets: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}
		// Move the password out of config and into secrets. An existing secret always wins: the
		// config copy is the stale one, and overwriting would downgrade a password the user has
		// already updated under the new layout.
		const legacyConfig = props.config
		if (legacyConfig?.pass) {
			if (!props.secrets?.pass) {
				changes.updatedSecrets = { pass: legacyConfig.pass }
			}
			delete legacyConfig.pass
			changes.updatedConfig = legacyConfig
		}

		for (const action of props.actions) {
			let actionChanged = false
			// Scene Actions
			if (
				action.actionId === 'set_scene' ||
				action.actionId === 'preview_scene' ||
				action.actionId === 'smart_switcher'
			) {
				// v3 chose the custom name through a magic '<CUSTOM SCENE NAME>' entry in the scene dropdown.
				if (getOpt(action.options, 'scene') === 'customSceneName') {
					action.options.scene = variablesToExpression(action.options.customSceneName) ?? {
						isExpression: false,
						value: '',
					}
				}
				delete action.options.custom
				delete action.options.customSceneName
				actionChanged = true
			} else if (action.actionId === 'previewNextScene') {
				action.actionId = 'adjustPreviewScene'
				setOpt(action.options, 'adjust', 'next')
				actionChanged = true
			} else if (action.actionId === 'previewPreviousScene') {
				action.actionId = 'adjustPreviewScene'
				setOpt(action.options, 'adjust', 'previous')
				actionChanged = true
			} else if (action.actionId === 'set_source_visible') {
				// Untested below
				if (getOpt(action.options, 'scene') === 'anyScene') {
					setOpt(action.options, 'anyScene', true)
					actionChanged = true
				} else if (getOpt(action.options, 'scene') === 'currentScene') {
					setOpt(action.options, 'useCurrentScene', true)
					actionChanged = true
				}
			} else if (action.actionId === 'set_filter_visible' || action.actionId === 'toggle_filter') {
				// The magic 'allSources' source name became an explicit target, while v3's "All" checkbox meant
				// every filter on the chosen source.
				const allSources = getOpt(action.options, 'source') === 'allSources'
				setOpt(action.options, 'target', allSources ? 'allSources' : 'source')
				if (allSources) {
					setOpt(action.options, 'source', '')
				} else {
					action.options.source = variablesToExpression(action.options.source)
				}
				setOpt(action.options, 'allFilters', getOpt(action.options, 'all') === true)
				action.options.filter = variablesToExpression(action.options.filter)
				delete action.options.all
				delete action.options.allSources
				actionChanged = true
			} else if (action.actionId === 'take_screenshot') {
				const source = getOpt(action.options, 'source')
				if (source === 'programScene' || source === 'previewScene') {
					setOpt(action.options, 'target', source)
					setOpt(action.options, 'source', '')
				} else {
					setOpt(action.options, 'target', 'source')
					// v3 picked "Custom" in the source dropdown and kept the real source in a second one.
					if (source === 'custom') action.options.source = action.options.custom ?? { isExpression: false, value: '' }
				}
				delete action.options.custom

				// v3 kept a folder and a file name; v4 takes the whole file path, or a prefix in the recording folder.
				const fileName =
					(getOpt(action.options, 'fileName') as string | undefined) ||
					'Screenshot_$(internal:date_iso)_$(internal:time_hms)'
				if (getOpt(action.options, 'customName') === true) {
					const folder = getOpt(action.options, 'path')
					if (typeof folder === 'string' && folder !== '') {
						const format = (getOpt(action.options, 'format') as string | undefined) || 'png'
						setOpt(action.options, 'path', `${folder}/${fileName}.${format}`)
					} else {
						setOpt(action.options, 'customName', false)
						setOpt(action.options, 'prefix', fileName)
					}
				}
				if (action.options.prefix === undefined) setOpt(action.options, 'prefix', 'Screenshot ')
				delete action.options.fileName
				delete action.options.useProgramScene
				delete action.options.usePreviewScene
				actionChanged = true
			} else if (action.actionId === 'set_scene_item_properties') {
				// Renamed to source_properties by consolidateAction below, so the target is set once here.
				setOpt(action.options, 'target', getOpt(action.options, 'scene') === 'current' ? 'programScene' : 'scene')
				delete action.options.useProgramScene
				actionChanged = true
			} else if (action.actionId === 'toggle_scene_item') {
				// The old boolean "all" flag became the allSources mode of the rewritten action, the single
				// Source dropdown became a multi-select, and the scene magic strings became a Target dropdown.
				const scene = getOpt(action.options, 'scene')
				if (scene === 'Current Scene') {
					setOpt(action.options, 'target', 'currentScene')
				} else {
					setOpt(action.options, 'target', 'scene')
					action.options.scene =
						scene === 'Preview Scene' ? PREVIEW_SCENE_EXPRESSION : variablesToExpression(action.options.scene)
				}

				if (getOpt(action.options, 'all') === true) {
					setOpt(action.options, 'allSources', true)
					setOpt(action.options, 'source', [])
				} else {
					setOpt(action.options, 'allSources', false)
					action.options.source = variablesToListExpression(action.options.source)
				}
				setOpt(action.options, 'except', [])
				setOpt(action.options, 'includeGroupChildren', 'groupsAndSources')
				setOpt(action.options, 'group', '')
				delete action.options.all
				delete action.options.anyScene
				actionChanged = true
			} else if (action.actionId === 'set_audio_monitor') {
				actionChanged = convertMonitorOption(action.options)
			} else if (action.actionId === 'set_transition_duration') {
				// The "Use Variable" text field folds into the number field as an expression.
				if (getOpt(action.options, 'useVariable') === true) {
					action.options.duration = FixupNumericOrVariablesValueToExpressions(action.options.variableValue)
				}
				delete action.options.useVariable
				delete action.options.variableValue
				actionChanged = true
			} else if (action.actionId === 'set_stream_settings') {
				// v3's fixed service list had a "Custom" entry backed by a separate name field; the service is now
				// one free-text field, and only a preset service uses it. v3 never sent a server, so it stays empty
				// and OBS keeps its current one, as before.
				const service =
					getOpt(action.options, 'service') === 'Custom' ? action.options.serviceName : action.options.service
				action.options.service =
					getOpt(action.options, 'streamType') === 'rtmp_common' && service
						? service
						: { isExpression: false, value: '' }
				setOpt(action.options, 'server', '')
				delete action.options.serviceName
				actionChanged = true
			} else if (action.actionId === 'open_projector') {
				// v3 shared one source dropdown between source and scene projectors.
				if (getOpt(action.options, 'type') === 'Scene' && action.options.scene === undefined) {
					action.options.scene = action.options.source
					actionChanged = true
				}
			} else if (action.actionId === 'source_properties') {
				const scene = getOpt(action.options, 'scene')
				if (scene === undefined || scene === 'Current Scene' || scene === 'current') {
					setOpt(action.options, 'target', 'programScene')
				} else {
					setOpt(action.options, 'target', 'scene')
					if (scene === 'Preview Scene') action.options.scene = PREVIEW_SCENE_EXPRESSION
				}
				delete action.options.useProgramScene
				const includedProps: string[] = []
				for (const key of ['positionX', 'positionY', 'scaleX', 'scaleY', 'rotation']) {
					const value = getOpt(action.options, key)
					if (value !== undefined && value !== null && value !== '') {
						includedProps.push(key)
					}
				}
				setOpt(action.options, 'props', includedProps)
				actionChanged = true
			}

			// Runs last so it also picks up the ids the branches above just rewrote.
			if (consolidateAction(action)) {
				actionChanged = true
			}

			// After consolidation, so legacy media ids (play_pause_media, set_media_time, …) are covered too.
			// The "Currently Playing" checkbox pointed at a single hidden value — the last clip that ever
			// started — and becomes the explicit "newest playing clip" target.
			if (convertMediaTarget(action)) {
				actionChanged = true
			}

			if (actionChanged) {
				changes.updatedActions.push(action)
			}
		}

		for (const feedback of props.feedbacks) {
			let feedbackChanged = false
			if (feedback.feedbackId === 'scene_item_active') {
				// "Current Scene" always matched program, which "All Scenes" already covers, so both fold into it.
				const allScenes =
					getOpt(feedback.options, 'scene') === 'anyScene' ||
					getOpt(feedback.options, 'anyScene') === true ||
					getOpt(feedback.options, 'useCurrentScene') === true
				setOpt(feedback.options, 'target', allScenes ? 'allScenes' : 'scene')
				if (allScenes) setOpt(feedback.options, 'scene', '')
				delete feedback.options.anyScene
				delete feedback.options.useCurrentScene
				feedbackChanged = true
			} else if (
				feedback.feedbackId === 'scenePreview' ||
				feedback.feedbackId === 'sceneProgram' ||
				feedback.feedbackId === 'scenePrevious'
			) {
				if (getOpt(feedback.options, 'custom') === true) {
					setOpt(feedback.options, 'scene', getOpt(feedback.options, 'customSceneName'))
				}
				delete feedback.options.custom
				delete feedback.options.customSceneName
				feedbackChanged = true
			} else if (feedback.feedbackId === 'scene_active') {
				const preview = getOpt(feedback.options, 'mode') === 'preview'
				feedback.feedbackId = preview ? 'scenePreview' : 'sceneProgram'
				feedback.style = {
					color: (getOpt(feedback.options, preview ? 'fg_preview' : 'fg') as number | undefined) ?? Color.White,
					bgcolor:
						(getOpt(feedback.options, preview ? 'bg_preview' : 'bg') as number | undefined) ??
						(preview ? Color.Green : Color.Red),
				}
				for (const key of ['mode', 'fg', 'bg', 'fg_preview', 'bg_preview']) delete feedback.options[key]
				feedbackChanged = true
			} else if (feedback.feedbackId === 'audioMeter') {
				feedback.feedbackId = 'audioPeaking'
				feedback.style = { color: Color.White, bgcolor: Color.Green }
				feedbackChanged = true
			} else if (feedback.feedbackId === 'streamCongestion') {
				feedback.feedbackId = 'streamCongestionAbove'
				feedback.style = {
					color: Color.White,
					bgcolor: (getOpt(feedback.options, 'colorHigh') as number | undefined) ?? Color.Red,
				}
				for (const key of ['colorNoStream', 'colorLow', 'colorMedium', 'colorHigh']) delete feedback.options[key]
				setOpt(feedback.options, 'threshold', Math.round(CONGESTION_MEDIOCRE * 100))
				feedbackChanged = true
			} else if (feedback.feedbackId === 'audio_monitor_type') {
				feedbackChanged = convertMonitorFeedback(feedback)
			} else if (feedback.feedbackId === 'recording' && ('fg' in feedback.options || 'bg' in feedback.options)) {
				// The advanced feedback coloured both recording and paused; paused is now its own feedback.
				feedback.style = {
					color: (getOpt(feedback.options, 'fg') as number | undefined) ?? Color.White,
					bgcolor: (getOpt(feedback.options, 'bg') as number | undefined) ?? Color.Red,
				}
				for (const key of ['fg', 'bg', 'fg_paused', 'bg_paused']) delete feedback.options[key]
				feedbackChanged = true
			} else if (feedback.feedbackId === 'audioPeaking' && 'peak' in feedback.options) {
				renameOpt(feedback.options, 'peak', 'threshold')
				feedbackChanged = true
			}
			// Peak hold is new in 4.0.0; existing indicators keep the old immediate release. Runs after
			// the rename above so feedbacks converted from audioMeter get it too.
			if (feedback.feedbackId === 'audioPeaking' && getOpt(feedback.options, 'peakHold') === undefined) {
				setOpt(feedback.options, 'peakHold', 0)
				feedbackChanged = true
			}
			if (feedbackChanged) {
				changes.updatedFeedbacks.push(feedback)
			}
		}

		return changes
	},
]
