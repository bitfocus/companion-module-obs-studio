import {
	CompanionMigrationAction,
	CompanionMigrationFeedback,
	CompanionUpgradeContext,
	CompanionStaticUpgradeResult,
	CreateConvertToBooleanFeedbackUpgradeScript,
} from '@companion-module/base'
import { ModuleConfig, ModuleSecrets } from './types.js'

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
	): CompanionStaticUpgradeResult<ModuleConfig> {
		const changes: CompanionStaticUpgradeResult<ModuleConfig> = {
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
				action.options.source = 'programScene'
				action.options.custom = ''
				changes.updatedActions.push(action)
			}
		}

		return changes
	},
	function v3_1_0(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: { config: any; actions: CompanionMigrationAction[]; feedbacks: CompanionMigrationFeedback[] },
	): CompanionStaticUpgradeResult<ModuleConfig> {
		const changes: CompanionStaticUpgradeResult<ModuleConfig> = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}

		for (const action of props.actions) {
			if (action.actionId === 'quick_transition') {
				if ((action.options.transition_time as number) > 0) {
					action.options.customDuration = true
				} else {
					action.options.customDuration = false
					action.options.transition_time = 500
				}
				changes.updatedActions.push(action)
			}
		}

		return changes
	},
	function v3_3_0(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: { config: any; actions: CompanionMigrationAction[]; feedbacks: CompanionMigrationFeedback[] },
	): CompanionStaticUpgradeResult<ModuleConfig> {
		const changes: CompanionStaticUpgradeResult<ModuleConfig> = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}

		for (const action of props.actions) {
			if (action.actionId === 'toggle_filter') {
				action.options.all = false
				changes.updatedActions.push(action)
			}
			if (action.actionId === 'toggle_scene_item') {
				if (action.options.source === 'allSources') {
					action.options.all = true
				} else {
					action.options.all = false
				}
				changes.updatedActions.push(action)
			}
		}
		for (const feedback of props.feedbacks) {
			if (feedback.feedbackId === 'scene_item_active_in_scene') {
				if (feedback.options.source === 'anySource') {
					feedback.options.any = true
				} else {
					feedback.options.any = false
				}
				changes.updatedFeedbacks.push(feedback)
			}
		}

		return changes
	},
	function v3_5_0(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: { config: any; actions: CompanionMigrationAction[]; feedbacks: CompanionMigrationFeedback[] },
	): CompanionStaticUpgradeResult<ModuleConfig> {
		const changes: CompanionStaticUpgradeResult<ModuleConfig> = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}

		for (const feedback of props.feedbacks) {
			if (feedback.feedbackId === 'streamCongestion') {
				if (!feedback.options.colorNoStream) {
					feedback.options = {
						...feedback.options,
						colorNoStream: '#464646',
						colorLow: '#00c800',
						colorMedium: '#d4ae00',
						colorHigh: '#c80000',
					}
				}
				changes.updatedFeedbacks.push(feedback)
			}
		}

		return changes
	},
	function v3_7_0(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: { config: any; actions: CompanionMigrationAction[]; feedbacks: CompanionMigrationFeedback[] },
	): CompanionStaticUpgradeResult<ModuleConfig> {
		const changes: CompanionStaticUpgradeResult<ModuleConfig> = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}

		for (const action of props.actions) {
			if (action.actionId === 'set_transition_duration') {
				if (typeof action.options.duration === 'number') {
					if (action.options.duration < 50) {
						action.options.duration = 50
					}
					if (action.options.duration > 20000) {
						action.options.duration = 20000
					}
				}
				action.options.variableValue = '500'
				action.options.useVariable = false
				changes.updatedActions.push(action)
			}
		}

		return changes
	},
	function v3_11_0(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: { config: any; actions: CompanionMigrationAction[]; feedbacks: CompanionMigrationFeedback[] },
	): CompanionStaticUpgradeResult<ModuleConfig> {
		const changes: CompanionStaticUpgradeResult<ModuleConfig> = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}

		for (const feedback of props.feedbacks) {
			if (feedback.feedbackId === 'audioMeter') {
				if (!feedback.options.threshold) {
					feedback.options.threshold = -60
				}
				changes.updatedFeedbacks.push(feedback)
			}
		}

		return changes
	},
	function v3_12_0(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: { config: any; actions: CompanionMigrationAction[]; feedbacks: CompanionMigrationFeedback[] },
	): CompanionStaticUpgradeResult<ModuleConfig> {
		const changes: CompanionStaticUpgradeResult<ModuleConfig> = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}
		for (const action of props.actions) {
			if (action.actionId === 'take_screenshot') {
				if (!action.options.customName && action.options.path) {
					action.options.customName = true
					action.options.fileName = ''
				} else if (!action.options.customName) {
					action.options.customName = false
					action.options.fileName = ''
				}

				changes.updatedActions.push(action)
			}
		}
		return changes
	},
	function v3_15_0(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: { config: any; actions: CompanionMigrationAction[]; feedbacks: CompanionMigrationFeedback[] },
	): CompanionStaticUpgradeResult<ModuleConfig> {
		const changes: CompanionStaticUpgradeResult<ModuleConfig> = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}
		for (const action of props.actions) {
			if (action.actionId === 'set_stream_settings') {
				if (!action.options.service) {
					action.options.service = 'Twitch'
				}
				if (!action.options.serviceName) {
					action.options.serviceName = 'Twitch'
				}
				if (!action.options.bearerToken) {
					action.options.bearerToken = ''
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
				action.options.custom = true
				if (action.options.scene !== 'customSceneName') {
					action.options.customSceneName = action.options.scene as string
				}
				actionChanged = true
			} else if (action.actionId === 'previewNextScene') {
				action.actionId = 'adjustPreviewScene'
				action.options.adjust = 'next'
				actionChanged = true
			} else if (action.actionId === 'previewPreviousScene') {
				action.actionId = 'adjustPreviewScene'
				action.options.adjust = 'previous'
				actionChanged = true
			} else if (action.actionId === 'set_source_visible') {
				//UNTESTED BELOW
				if (action.options.scene === 'anyScene') {
					action.options.anyScene = true
					actionChanged = true
				} else if (action.options.scene === 'currentScene') {
					action.options.useCurrentScene = true
					actionChanged = true
				}
			} else if (action.actionId === 'set_filter_visible') {
				if (action.options.source === 'allSources') {
					action.options.allSources = true
					actionChanged = true
				}
			} else if (action.actionId === 'take_screenshot') {
				if (action.options.source === 'programScene') {
					action.options.useProgramScene = true
					actionChanged = true
				} else if (action.options.source === 'previewScene') {
					action.options.usePreviewScene = true
					actionChanged = true
				}
			} else if (action.actionId === 'set_scene_item_properties') {
				if (action.options.scene === 'current') {
					action.options.useProgramScene = true
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
				if (feedback.options.scene === 'anyScene') {
					feedback.options.anyScene = true
					feedbackChanged = true
				}
			} else if (
				feedback.feedbackId === 'scenePreview' ||
				feedback.feedbackId === 'sceneProgram' ||
				feedback.feedbackId === 'scenePrevious'
			) {
				if (feedback.options.scene) {
					feedback.options.custom = true
					feedback.options.customSceneName = feedback.options.scene as string
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
