import {
	CompanionMigrationAction,
	CompanionMigrationFeedback,
	CompanionUpgradeContext,
	CompanionStaticUpgradeResult,
	CreateConvertToBooleanFeedbackUpgradeScript,
} from '@companion-module/base'
import { ModuleConfig, ModuleSecrets } from './types.js'

function getOpt(options: any, key: string): any {
	const opt = options[key]
	return opt !== null && typeof opt === 'object' && 'value' in opt ? opt.value : opt
}

function setOpt(options: any, key: string, value: any): void {
	const opt = options[key]
	if (opt !== null && typeof opt === 'object' && 'value' in opt) {
		opt.value = value
	} else {
		options[key] = value
	}
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
		props: { config: any; actions: CompanionMigrationAction[]; feedbacks: CompanionMigrationFeedback[] },
	): CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> {
		const changes: CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}
		if (props.config) {
			const config = props.config
			if (config.port == undefined || config.port == '' || config.port == 4444) {
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
		props: { config: any; actions: CompanionMigrationAction[]; feedbacks: CompanionMigrationFeedback[] },
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
		props: { config: any; actions: CompanionMigrationAction[]; feedbacks: CompanionMigrationFeedback[] },
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
		props: { config: any; actions: CompanionMigrationAction[]; feedbacks: CompanionMigrationFeedback[] },
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
		props: { config: any; actions: CompanionMigrationAction[]; feedbacks: CompanionMigrationFeedback[] },
	): CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> {
		const changes: CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}

		for (const action of props.actions) {
			if (action.actionId === 'set_transition_duration') {
				if (typeof getOpt(action.options, 'duration') === 'number') {
					if (getOpt(action.options, 'duration') < 50) {
						setOpt(action.options, 'duration', 50)
					}
					if (getOpt(action.options, 'duration') > 20000) {
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
		props: { config: any; actions: CompanionMigrationAction[]; feedbacks: CompanionMigrationFeedback[] },
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
		props: { config: any; actions: CompanionMigrationAction[]; feedbacks: CompanionMigrationFeedback[] },
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
		props: { config: any; actions: CompanionMigrationAction[]; feedbacks: CompanionMigrationFeedback[] },
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
	function v4_0_0(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: { config: any; actions: CompanionMigrationAction[]; feedbacks: CompanionMigrationFeedback[] },
	): CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> {
		const changes: CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> = {
			updatedConfig: null,
			updatedSecrets: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}
		if (props.config) {
			if (props.config.pass) {
				changes.updatedSecrets = {
					pass: props.config.pass,
				}
				delete props.config.pass
				changes.updatedConfig = props.config
			}
		}

		for (const action of props.actions) {
			let actionChanged = false
			//Scene Actions
			if (
				action.actionId === 'set_scene' ||
				action.actionId === 'preview_scene' ||
				action.actionId === 'smart_switcher'
			) {
				setOpt(action.options, 'custom', true)
				if (getOpt(action.options, 'scene') !== 'customSceneName') {
					setOpt(action.options, 'customSceneName', getOpt(action.options, 'scene'))
				}
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
				//UNTESTED BELOW
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
				if (getOpt(feedback.options, 'scene')) {
					setOpt(feedback.options, 'custom', true)
					setOpt(feedback.options, 'customSceneName', getOpt(feedback.options, 'scene'))
					feedbackChanged = true
				}
			}
			if (feedbackChanged) {
				changes.updatedFeedbacks.push(feedback)
			}
		}

		return changes
	},
]
