import { CreateConvertToBooleanFeedbackUpgradeScript } from '@companion-module/base'

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
	function v2_0_0(context, props) {
		let changes = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}
		if (props.config) {
			let config = props.config
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
	function v3_1_0(context, props) {
		let changes = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}

		for (const action of props.actions) {
			if (action.actionId === 'quick_transition') {
				if (action.options.transition_time > 0) {
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
	function v3_3_0(context, props) {
		let changes = {
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
]
