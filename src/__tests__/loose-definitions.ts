import type { CompanionActionDefinition, CompanionFeedbackDefinition } from '@companion-module/base'

/**
 * The definition maps are keyed by literal ids and their values include `false | undefined`,
 * which suits production code but not tests that iterate over every definition generically.
 * These views widen the maps back to plain records so such tests can index them by string.
 */
export type LooseActions = Record<string, CompanionActionDefinition>
export type LooseFeedbacks = Record<string, CompanionFeedbackDefinition>

export function looseActions(actions: object): LooseActions {
	return actions as LooseActions
}

export function looseFeedbacks(feedbacks: object): LooseFeedbacks {
	return feedbacks as LooseFeedbacks
}
