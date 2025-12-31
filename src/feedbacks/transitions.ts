import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type { OBSInstance } from '../main.js'
import { Color } from '../utils.js'

export function getTransitionFeedbacks(self: OBSInstance): CompanionFeedbackDefinitions {
	const feedbacks: CompanionFeedbackDefinitions = {}

	feedbacks['transition_active'] = {
		type: 'boolean',
		name: 'Transition - In Progress',
		description: 'If an OBS transition is currently in progress, change the style of the button',
		defaultStyle: {
			color: Color.White,
			bgcolor: Color.Green,
		},
		options: [],
		callback: () => {
			return !!self.states.transitionActive
		},
	}

	feedbacks['current_transition'] = {
		type: 'boolean',
		name: 'Transition - Type',
		description:
			'If a specific transition type is currently selected as the active transition, change the style of the button',
		defaultStyle: {
			color: Color.White,
			bgcolor: Color.Green,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Transition',
				id: 'transition',
				default: self.obsState.transitionList?.[0] ? self.obsState.transitionList[0].id : '',
				choices: self.obsState.transitionList,
			},
		],
		callback: (feedback) => {
			if (self.states.currentTransition === feedback.options.transition) {
				return true
			}
			return false
		},
	}

	feedbacks['transition_duration'] = {
		type: 'boolean',
		name: 'Transition - Duration',
		description: 'If the current transition duration matches a specific time, change the style of the button',
		defaultStyle: {
			color: Color.White,
			bgcolor: Color.Green,
		},
		options: [
			{
				type: 'number',
				label: 'Transition time (in ms)',
				id: 'duration',
				default: 500,
				min: 0,
				max: 60 * 1000, //max is required by api
				range: false,
			},
		],
		callback: (feedback) => {
			return self.states.transitionDuration === (feedback.options.duration as number)
		},
	}

	return feedbacks
}
