import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { opt, Color } from '../utils.js'

export function getUiConfigCustomFeedbacks(self: OBSInstance): CompanionFeedbackDefinitions {
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
				allowCustom: true,
				label: 'Profile',
				id: 'profile',
				default: self.obsState.profileChoicesDefault,
				choices: self.obsState.profileChoices,
			},
		],
		callback: (feedback) => {
			return self.states.currentProfile === opt<string>(feedback, 'profile')
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
				allowCustom: true,
				label: 'Scene Collection',
				id: 'scene_collection',
				default: self.obsState.sceneCollectionList?.[0] ? self.obsState.sceneCollectionList[0].id : '',
				choices: self.obsState.sceneCollectionList,
			},
		],
		callback: (feedback) => {
			return self.states.currentSceneCollection === opt<string>(feedback, 'scene_collection')
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
				clampValues: true,
			},
		],
		callback: (feedback) => {
			return (self.states.stats?.availableDiskSpace ?? 1000000) < opt<number>(feedback, 'diskSpace')
		},
	}

	feedbacks['vendorEvent'] = {
		type: 'boolean',
		name: 'Vendor Event',
		description: 'Change the style of the button based on third party vendor events',
		defaultStyle: {
			color: Color.White,
			bgcolor: Color.Green,
		},
		options: [
			{
				type: 'textinput',
				label: 'vendorName',
				id: 'vendorName',
				default: 'downstream-keyer',
			},
			{
				type: 'textinput',
				label: 'eventType',
				id: 'eventType',
				default: 'dsk_scene_changed',
			},
			{
				type: 'textinput',
				label: 'eventData Key',
				id: 'eventDataKey',
				default: 'new_scene',
			},
			{
				type: 'textinput',
				label: 'eventData Value',
				id: 'eventDataValue',
				default: 'Scene 1',
			},
		],
		callback: (feedback) => {
			const event = self.states.vendorEvent as {
				vendorName?: string
				eventType?: string
				eventData?: Record<string, unknown>
			}
			if (
				event?.vendorName === opt<string>(feedback, 'vendorName') &&
				event?.eventType === opt<string>(feedback, 'eventType') &&
				event?.eventData
			) {
				const key = event.eventData[opt<string>(feedback, 'eventDataKey')]
				return key !== undefined && key === opt<string>(feedback, 'eventDataValue')
			}
			return false
		},
	}

	return feedbacks
}
