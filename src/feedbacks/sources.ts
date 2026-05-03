import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { opt, Color } from '../utils.js'

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
			const sourceName = opt<string>(feedback, 'source')
			const source = self.obsState.findSourceByName(sourceName)
			if (!source?.active) return false

			if (opt<any>(feedback, 'anyScene')) {
				return true
			} else {
				const sceneName = opt<any>(feedback, 'useCurrentScene')
					? self.states.programScene
					: opt<string>(feedback, 'scene')
				return sceneName === self.states.programScene
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
			return !!self.obsState.findSourceByName(opt<string>(feedback, 'source'))?.videoShowing
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
				isVisibleExpression: `!$(options:any)`,
			},
		],
		callback: (feedback) => {
			const sceneName = opt<string>(feedback, 'scene')
			const sourceName = opt<string>(feedback, 'source')

			if (opt<any>(feedback, 'any')) {
				const scene = self.obsState.findSceneItemsByName(sceneName)

				if (scene) {
					const enabled = scene.find((item) => item.sceneItemEnabled === true)
					if (enabled) {
						return true
					}
				}
			} else {
				const source = self.obsState.findSourceByName(sourceName)
				if (source?.groupedSource) {
					const groupName = source.groupName
					if (groupName) {
						const group = self.obsState.findGroupItemsByName(groupName)
						const sceneItem = group?.find((item) => item.sourceUuid === source.sourceUuid)
						if (sceneItem) {
							return sceneItem.sceneItemEnabled
						}
					}
				} else {
					const scene = self.obsState.findSceneItemsByName(sceneName)
					if (scene) {
						const sceneItem = scene.find((item) => item.sourceUuid === source?.sourceUuid)
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
			const sourceName = opt<string>(feedback, 'source')
			const sourceFilters = self.obsState.findSourceFiltersByName(sourceName)
			if (sourceFilters) {
				const filter = sourceFilters.find((item) => item.filterName === opt<string>(feedback, 'filter'))
				return !!filter?.filterEnabled
			}
			return false
		},
	}

	return feedbacks
}
