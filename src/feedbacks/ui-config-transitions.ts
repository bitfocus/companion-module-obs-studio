import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type { OBSInstance } from '../main.js'
import { Color } from '../utils.js'

export function getUiConfigTransitionsFeedbacks(self: OBSInstance): CompanionFeedbackDefinitions {
	const feedbacks: CompanionFeedbackDefinitions = {}

	feedbacks['profile_active'] = {
		type: 'boolean',
		name: 'Profile Active',
		description: 'If a specific OBS profile is currently active, change the style of the button',
		defaultStyle: {
			color: Color.White,
			bgcolor: Color.Green,
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
		description: 'If a specific scene collection is currently active, change the style of the button',
		defaultStyle: {
			color: Color.White,
			bgcolor: Color.Green,
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
		name: 'Current Transition Type',
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
		name: 'Transition Duration',
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

	feedbacks['studioMode'] = {
		type: 'boolean',
		name: 'Studio Mode Active',
		description: 'If Studio Mode is currently enabled, change the style of the button',
		defaultStyle: {
			color: Color.White,
			bgcolor: Color.Green,
		},
		options: [],
		callback: () => {
			return !!self.states.studioMode
		},
	}

	feedbacks['freeDiskSpaceRemaining'] = {
		type: 'boolean',
		name: 'Disk Space Remaining',
		description:
			'If the remaining disk space on the drive OBS is recording to is below a certain threshold, change the style of the button',
		defaultStyle: {
			color: Color.White,
			bgcolor: Color.Red,
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
			console.log(self.states.stats?.availableDiskSpace)
			return (self.states.stats?.availableDiskSpace ?? 1000000) < (feedback.options.diskSpace as number)
		},
	}

	return feedbacks
}
