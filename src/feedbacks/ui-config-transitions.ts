import { CompanionFeedbackDefinitions, combineRgb } from '@companion-module/base'
import type { OBSInstance } from '../main.js'

export function getUiConfigTransitionsFeedbacks(self: OBSInstance): CompanionFeedbackDefinitions {
	const feedbacks: CompanionFeedbackDefinitions = {}

	const ColorWhite = combineRgb(255, 255, 255)
	const ColorRed = combineRgb(200, 0, 0)
	const ColorGreen = combineRgb(0, 200, 0)

	feedbacks['profile_active'] = {
		type: 'boolean',
		name: 'Profile Active',
		description: 'If a profile is active, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Profile name',
				id: 'profile',
				default: self.obsState.profileChoicesDefault,
				choices: self.obsState.profileChoices,
			},
		],
		callback: (feedback) => {
			return self.states.currentProfile === (feedback.options.profile as string)
		},
	}

	feedbacks['scene_collection_active'] = {
		type: 'boolean',
		name: 'Scene Collection Active',
		description: 'If a scene collection is active, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Scene collection name',
				id: 'scene_collection',
				default: self.obsState.sceneCollectionList?.[0] ? self.obsState.sceneCollectionList[0].id : '',
				choices: self.obsState.sceneCollectionList,
			},
		],
		callback: (feedback) => {
			return self.states.currentSceneCollection === (feedback.options.scene_collection as string)
		},
	}

	feedbacks['transition_active'] = {
		type: 'boolean',
		name: 'Transition in Progress',
		description: 'If a transition is in progress, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [],
		callback: () => {
			return !!self.states.transitionActive
		},
	}

	feedbacks['current_transition'] = {
		type: 'boolean',
		name: 'Current Transition Type',
		description: 'If a transition type is selected, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorGreen,
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
		name: 'Transition Duration',
		description: 'If the transition duration is matched, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorGreen,
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

	feedbacks['studioMode'] = {
		type: 'boolean',
		name: 'Studio Mode Active',
		description: 'If Studio Mode is active, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [],
		callback: () => {
			return !!self.states.studioMode
		},
	}

	feedbacks['freeDiskSpaceRemaining'] = {
		type: 'boolean',
		name: 'Disk Space Remaining',
		description: 'Change the style of the button if remaining disk space is below a certain value',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorRed,
		},
		options: [
			{
				type: 'number',
				label: 'Remaining Space (MB)',
				id: 'diskSpace',
				default: 10000,
				min: 0,
				max: 1000000,
				range: false,
			},
		],
		callback: (feedback) => {
			return (self.states.stats?.availableDiskSpace ?? 1000000) < (feedback.options.diskSpace as number)
		},
	}

	return feedbacks
}
