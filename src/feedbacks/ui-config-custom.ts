import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { styleActive, styleCaution } from '../presets/style.js'
import { firstChoiceId } from '../actions/options.js'

export type UiConfigCustomFeedbackSchemas = {
	profile_active: { type: 'boolean'; options: { profile: string } }
	scene_collection_active: { type: 'boolean'; options: { scene_collection: string } }
	studioMode: { type: 'boolean'; options: Record<string, never> }
	freeDiskSpaceRemaining: { type: 'boolean'; options: { diskSpace: number } }
	vendorEvent: {
		type: 'boolean'
		options: { vendorName: string; eventType: string; eventDataKey: string; eventDataValue: string }
	}
}

export function getUiConfigCustomFeedbacks(
	self: OBSInstance,
): CompanionFeedbackDefinitions<UiConfigCustomFeedbackSchemas> {
	return {
		profile_active: {
			type: 'boolean',
			name: 'Profile Active',
			description: 'If a specific OBS profile is currently active, change the style of the button',
			defaultStyle: styleActive(),
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
				return self.states.currentProfile === feedback.options.profile
			},
		},

		scene_collection_active: {
			type: 'boolean',
			name: 'Scene Collection Active',
			description: 'If a specific scene collection is currently active, change the style of the button',
			defaultStyle: styleActive(),
			options: [
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Scene Collection',
					id: 'scene_collection',
					default: firstChoiceId(self.obsState.sceneCollectionList),
					choices: self.obsState.sceneCollectionList,
				},
			],
			callback: (feedback) => {
				return self.states.currentSceneCollection === feedback.options.scene_collection
			},
		},

		studioMode: {
			type: 'boolean',
			name: 'Studio Mode Active',
			description: 'If Studio Mode is currently enabled, change the style of the button',
			defaultStyle: styleActive(),
			options: [],
			callback: () => {
				return !!self.states.studioMode
			},
		},

		freeDiskSpaceRemaining: {
			type: 'boolean',
			name: 'Disk Space Remaining',
			description:
				'If the remaining disk space on the drive OBS is recording to is below a certain threshold, change the style of the button',
			defaultStyle: styleCaution(),
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
				return (self.states.stats?.availableDiskSpace ?? 1000000) < feedback.options.diskSpace
			},
		},

		vendorEvent: {
			type: 'boolean',
			name: 'Custom - Vendor Event',
			description: 'Change the style of the button based on third party vendor events',
			defaultStyle: styleActive(),
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
					event?.vendorName === feedback.options.vendorName &&
					event?.eventType === feedback.options.eventType &&
					event?.eventData
				) {
					const key = event.eventData[feedback.options.eventDataKey]
					return key !== undefined && key === feedback.options.eventDataValue
				}
				return false
			},
		},
	}
}
