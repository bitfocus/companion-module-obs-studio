import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type { OBSInstance } from '../main.js'
import { Color } from '../utils.js'

export function getSourceFeedbacks(self: OBSInstance): CompanionFeedbackDefinitions {
	const feedbacks: CompanionFeedbackDefinitions = {}

	feedbacks['scene_item_active'] = {
		type: 'boolean',
		name: 'Source - Visible in Program',
		description:
			'If a source is currently visible in the program output (either directly or via a scene), change the style of the button',
		defaultStyle: {
			color: Color.White,
			bgcolor: Color.Red,
		},
		options: [
			{
				type: 'checkbox',
				label: 'All Scenes',
				id: 'anyScene',
				default: true,
			},
			{
				type: 'checkbox',
				label: 'Current Scene',
				id: 'useCurrentScene',
				default: false,
				isVisibleExpression: `!$(options:anyScene)`,
			},
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: self.obsState.sceneListDefault,
				choices: self.obsState.sceneChoices,
				isVisibleExpression: `!$(options:anyScene) && !$(options:useCurrentScene)`,
			},
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.sourceListDefault,
				choices: self.obsState.sourceChoices,
			},
		],
		callback: (feedback) => {
			const sourceUuid = feedback.options.source as string
			const source = self.states.sources.get(sourceUuid)
			if (!source?.active) return false

			if (feedback.options.anyScene) {
				return true
			} else {
				const sceneUuid = feedback.options.useCurrentScene
					? self.states.programSceneUuid
					: (feedback.options.scene as string)
				return sceneUuid === self.states.programSceneUuid
			}
		},
	}

	feedbacks['scene_item_previewed'] = {
		type: 'boolean',
		name: 'Source - Active in Preview',
		description: 'If a source is currently enabled in the preview scene, change the style of the button',
		defaultStyle: {
			color: Color.White,
			bgcolor: Color.Green,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: self.obsState.sourceListDefault,
				choices: self.obsState.sourceChoices,
			},
		],
		callback: (feedback) => {
			return !!self.states.sources.get(feedback.options.source as string)?.videoShowing
		},
	}

	feedbacks['scene_item_active_in_scene'] = {
		type: 'boolean',
		name: 'Source - Enabled in Scene',
		description: 'If a specific source is enabled in a specific scene, change the style of the button',
		defaultStyle: {
			color: Color.White,
			bgcolor: Color.Green,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: self.obsState.sceneListDefault,
				choices: self.obsState.sceneChoices,
				allowCustom: true,
			},
			{
				type: 'checkbox',
				label: 'Any Source',
				id: 'any',
				default: false,
			},
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.sourceListDefault,
				choices: self.obsState.sourceChoices,
				allowCustom: true,
				isVisibleExpression: `!$(options:any)`,
			},
		],
		callback: (feedback) => {
			const sceneUuid = feedback.options.scene as string
			const sourceUuid = feedback.options.source as string

			if (feedback.options.any) {
				const scene = self.states.sceneItems.get(sceneUuid)

				if (scene) {
					const enabled = scene.find((item: any) => item.sceneItemEnabled === true)
					if (enabled) {
						return true
					}
				}
			} else {
				const source = self.states.sources.get(sourceUuid)
				if (source?.groupedSource) {
					const groupUuid = source.groupName // groupName is now groupUuid
					if (groupUuid) {
						const group = self.states.groups.get(groupUuid)
						const sceneItem = group?.find((item: any) => item.sourceUuid === sourceUuid)
						if (sceneItem) {
							return sceneItem.sceneItemEnabled
						}
					}
				} else {
					const scene = self.states.sceneItems.get(sceneUuid)
					if (scene) {
						const sceneItem = scene.find((item: any) => item.sourceUuid === sourceUuid)
						if (sceneItem) {
							return sceneItem.sceneItemEnabled
						}
					}
				}
			}
			return false
		},
	}

	feedbacks['filter_enabled'] = {
		type: 'boolean',
		name: 'Filter - Enabled',
		description: 'If a specific filter is enabled on a source, change the style of the button',
		defaultStyle: {
			color: Color.White,
			bgcolor: Color.Green,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.sourceListDefault,
				choices: self.obsState.sourceChoicesWithScenes,
			},
			{
				type: 'dropdown',
				label: 'Filter',
				id: 'filter',
				default: self.obsState.filterListDefault,
				choices: self.obsState.filterList,
			},
		],
		callback: (feedback) => {
			const sourceUuid = feedback.options.source as string
			const sourceFilters = self.states.sourceFilters.get(sourceUuid)
			if (sourceFilters) {
				const filter = sourceFilters.find((item) => item.filterName === (feedback.options.filter as string))
				return !!filter?.filterEnabled
			}
			return false
		},
	}

	return feedbacks
}
