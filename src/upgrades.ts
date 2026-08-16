import {
	CompanionStaticUpgradeProps,
	CompanionUpgradeContext,
	CompanionStaticUpgradeResult,
	CreateConvertToBooleanFeedbackUpgradeScript,
	CompanionMigrationAction,
	CompanionMigrationFeedback,
} from '@companion-module/base'
import { LegacyModuleConfig, ModuleConfig, ModuleSecrets, ObsAudioMonitorType } from './types.js'

function getOpt(options: Record<string, unknown>, key: string): unknown {
	const opt = options[key]
	return opt !== null && typeof opt === 'object' && 'value' in opt ? opt.value : opt
}

function setOpt(options: Record<string, unknown>, key: string, value: unknown): void {
	const opt = options[key]
	if (opt !== null && typeof opt === 'object' && 'value' in opt) {
		opt.value = value
	} else {
		options[key] = value
	}
}

/**
 * The monitor option went from OBS's three-state monitor type to a plain enabled/disabled value, matching the
 * OBS 32.1+ mixer where monitoring is a single toggle. Both monitoring types become enabled; anything that
 * isn't one of the three known types (an expression, or an already-converted value) is left alone.
 */
function convertMonitorOption(options: Record<string, unknown>): boolean {
	const monitor = getOpt(options, 'monitor')
	if (monitor === ObsAudioMonitorType.None) {
		setOpt(options, 'monitor', 'false')
		return true
	}
	if (monitor === ObsAudioMonitorType.MonitorOnly || monitor === ObsAudioMonitorType.MonitorAndOutput) {
		setOpt(options, 'monitor', 'true')
		return true
	}
	return false
}

/**
 * The feedback lost its monitor option entirely and is now simply true while monitoring is enabled, so a
 * feedback that matched "Off" has to be inverted to keep meaning the same thing.
 */
function convertMonitorFeedback(feedback: CompanionMigrationFeedback): boolean {
	const monitor = getOpt(feedback.options, 'monitor')
	if (
		monitor !== ObsAudioMonitorType.None &&
		monitor !== ObsAudioMonitorType.MonitorOnly &&
		monitor !== ObsAudioMonitorType.MonitorAndOutput
	) {
		return false
	}

	// An inversion driven by an expression can't be flipped statically, so it is left as the user set it.
	if (monitor === ObsAudioMonitorType.None && feedback.isInverted?.isExpression !== true) {
		feedback.isInverted = { isExpression: false, value: feedback.isInverted?.value !== true }
	}
	delete feedback.options.monitor
	return true
}

function renameOpt(options: Record<string, unknown>, from: string, to: string): void {
	if (!(from in options)) return
	options[to] = options[from]
	delete options[from]
}

/**
 * Action families that used to be one action per command (recording start/stop/pause/…), or a
 * set/adjust pair, are now a single action with a leading dropdown. Each entry names the combined
 * action, the fixed option values that identify the old command, and any option renames it needs.
 */
const CONSOLIDATED_ACTIONS: Record<
	string,
	{ actionId: string; options: Record<string, unknown>; renames?: Record<string, string> }
> = {
	start_recording: { actionId: 'recording', options: { action: 'start' } },
	stop_recording: { actionId: 'recording', options: { action: 'stop' } },
	pause_recording: { actionId: 'recording', options: { action: 'pause' } },
	resume_recording: { actionId: 'recording', options: { action: 'resume' } },
	ToggleRecordPause: { actionId: 'recording', options: { action: 'toggle_pause' } },
	toggle_recording: { actionId: 'recording', options: { action: 'toggle' } },
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
		renames: { volume: 'amount' },
	},

	set_audio_offset: { actionId: 'audio_offset', options: { mode: 'set' }, renames: { offset: 'value' } },
	adjust_audio_offset: { actionId: 'audio_offset', options: { mode: 'adjust' } },
	set_audio_balance: { actionId: 'audio_balance', options: { mode: 'set' }, renames: { balance: 'value' } },
	adjust_audio_balance: { actionId: 'audio_balance', options: { mode: 'adjust' } },

	set_transition_type: { actionId: 'transition_type', options: { mode: 'set' } },
	set_transition_duration: {
		actionId: 'transition_duration',
		options: { mode: 'set' },
		renames: { duration: 'value' },
	},
	adjust_transition_duration: { actionId: 'transition_duration', options: { mode: 'adjust' } },

	preview_scene: { actionId: 'preview_scene', options: { mode: 'set' } },
}

/**
 * The "adjust" actions carried a next/previous dropdown that becomes one more choice on the
 * combined action's mode dropdown, so their value is mapped across rather than fixed.
 */
const ADJUST_TO_MODE_ACTIONS: Record<string, string> = {
	adjustTransitionType: 'transition_type',
	adjustPreviewScene: 'preview_scene',
}

function consolidateAction(action: CompanionMigrationAction): boolean {
	const adjustTarget = ADJUST_TO_MODE_ACTIONS[action.actionId]
	if (adjustTarget) {
		action.actionId = adjustTarget
		setOpt(action.options, 'mode', getOpt(action.options, 'adjust') === 'previous' ? 'previous' : 'next')
		delete action.options.adjust
		return true
	}

	const consolidated = CONSOLIDATED_ACTIONS[action.actionId]
	if (!consolidated) return false

	action.actionId = consolidated.actionId
	for (const [from, to] of Object.entries(consolidated.renames ?? {})) {
		renameOpt(action.options, from, to)
	}
	for (const [key, value] of Object.entries(consolidated.options)) {
		setOpt(action.options, key, value)
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
				if (getOpt(action.options, 'custom') === true) {
					setOpt(action.options, 'scene', getOpt(action.options, 'customSceneName'))
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
			} else if (action.actionId === 'set_filter_visible') {
				if (getOpt(action.options, 'source') === 'allSources') {
					setOpt(action.options, 'allSources', true)
					actionChanged = true
				}
			} else if (action.actionId === 'take_screenshot') {
				if (getOpt(action.options, 'source') === 'programScene') {
					setOpt(action.options, 'useProgramScene', true)
					actionChanged = true
				} else if (getOpt(action.options, 'source') === 'previewScene') {
					setOpt(action.options, 'usePreviewScene', true)
					actionChanged = true
				}
			} else if (action.actionId === 'set_scene_item_properties') {
				if (getOpt(action.options, 'scene') === 'current') {
					setOpt(action.options, 'useProgramScene', true)
					actionChanged = true
				}
			} else if (action.actionId === 'toggle_scene_item' && getOpt(action.options, 'all') === true) {
				// The "All Sources" flag was dropped when the action was rewritten for
				// anyScene/useCurrentScene; move those configs onto the new dedicated action.
				action.actionId = 'toggle_all_scene_items'
				const scene = getOpt(action.options, 'scene')
				if (scene === 'Current Scene') {
					setOpt(action.options, 'useCurrentScene', true)
				} else if (scene === 'Preview Scene') {
					setOpt(action.options, 'useCurrentScene', false)
					setOpt(action.options, 'scene', '$(obs:scene_preview)')
				} else {
					setOpt(action.options, 'useCurrentScene', false)
				}
				setOpt(action.options, 'except', [])
				delete action.options.all
				delete action.options.source
				delete action.options.anyScene
				actionChanged = true
			} else if (action.actionId === 'set_audio_monitor') {
				actionChanged = convertMonitorOption(action.options)
			}

			// Runs last so it also picks up the ids the branches above just rewrote.
			if (consolidateAction(action)) {
				actionChanged = true
			}

			if (actionChanged) {
				changes.updatedActions.push(action)
			}
		}

		for (const feedback of props.feedbacks) {
			let feedbackChanged = false
			if (feedback.feedbackId === 'scene_item_active') {
				if (getOpt(feedback.options, 'scene') === 'anyScene') {
					setOpt(feedback.options, 'anyScene', true)
					feedbackChanged = true
				}
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
			} else if (feedback.feedbackId === 'audio_monitor_type') {
				feedbackChanged = convertMonitorFeedback(feedback)
			}
			if (feedbackChanged) {
				changes.updatedFeedbacks.push(feedback)
			}
		}

		return changes
	},
]
