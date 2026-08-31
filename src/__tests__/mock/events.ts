import type {
	CompanionActionDefinition,
	CompanionActionEvent,
	CompanionFeedbackBooleanEvent,
	CompanionFeedbackDefinition,
	CompanionFeedbackInfo,
	CompanionOptionValues,
} from '@companion-module/base'

/** An action invocation, as Companion delivers it to a callback. */
export function actionEvent(actionId: string, options: CompanionOptionValues): CompanionActionEvent {
	return { id: 'test', controlId: 'control', actionId, options } as unknown as CompanionActionEvent
}

/** A feedback invocation, as Companion delivers it to a callback. */
export function feedbackEvent(feedbackId: string, options: CompanionOptionValues): CompanionFeedbackBooleanEvent {
	return { id: 'test', controlId: 'control', feedbackId, options } as unknown as CompanionFeedbackBooleanEvent &
		CompanionFeedbackInfo
}

/** Builds an options object from each option's declared default. */
export function defaultOptions(def: CompanionActionDefinition | CompanionFeedbackDefinition): CompanionOptionValues {
	const options: CompanionOptionValues = {}
	for (const option of def.options) {
		if ('id' in option && 'default' in option) {
			options[option.id] = option.default
		}
	}
	return options
}
