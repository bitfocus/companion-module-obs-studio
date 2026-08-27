import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { styleActive, stylePreview, styleProgram } from '../presets/style.js'

export type SourceFeedbackSchemas = {
	scene_item_active: {
		type: 'boolean'
		options: { anyScene: boolean; useCurrentScene: boolean; scene: string; source: string }
	}
	scene_item_previewed: { type: 'boolean'; options: { source: string } }
	scene_item_active_in_scene: { type: 'boolean'; options: { scene: string; any: boolean; source: string } }
	filter_enabled: { type: 'boolean'; options: { source: string; filter: string } }
}

export function getSourceFeedbacks(self: OBSInstance): CompanionFeedbackDefinitions<SourceFeedbackSchemas> {
	return {
		scene_item_active: {
			type: 'boolean',
			name: 'Source - Visible in Program',
			description:
				'If a source is currently visible in the program output (either directly or via a scene), change the style of the button',
			defaultStyle: styleProgram(),
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
					allowCustom: true,
					label: 'Scene',
					id: 'scene',
					default: self.obsState.sceneListDefault,
					choices: self.obsState.sceneChoices,
					isVisibleExpression: `!$(options:anyScene) && !$(options:useCurrentScene)`,
				},
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Source',
					id: 'source',
					default: self.obsState.sourceListDefault,
					choices: self.obsState.sourceChoices,
				},
			],
			callback: (feedback) => {
				const sourceName = feedback.options.source
				const source = self.obsState.findSourceByName(sourceName)
				if (!source?.active) return false

				if (feedback.options.anyScene) {
					return true
				} else {
					const sceneName = feedback.options.useCurrentScene ? self.states.programScene : feedback.options.scene
					return sceneName === self.states.programScene
				}
			},
		},

		scene_item_previewed: {
			type: 'boolean',
			name: 'Source - Active in Preview',
			description: 'If a source is currently enabled in the preview scene, change the style of the button',
			defaultStyle: stylePreview(),
			options: [
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Source name',
					id: 'source',
					default: self.obsState.sourceListDefault,
					choices: self.obsState.sourceChoices,
				},
			],
			callback: (feedback) => {
				return !!self.obsState.findSourceByName(feedback.options.source)?.videoShowing
			},
		},

		scene_item_active_in_scene: {
			type: 'boolean',
			name: 'Source - Enabled in Scene',
			description: 'If a specific source is enabled in a specific scene, change the style of the button',
			defaultStyle: styleActive(),
			options: [
				{
					type: 'dropdown',
					allowCustom: true,
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
					allowCustom: true,
					label: 'Source',
					id: 'source',
					default: self.obsState.sourceListDefault,
					choices: self.obsState.sourceChoices,
					isVisibleExpression: `!$(options:any)`,
				},
			],
			callback: (feedback) => {
				const sceneName = feedback.options.scene
				const sourceName = feedback.options.source

				if (feedback.options.any) {
					const scene = self.obsState.findSceneItemsByName(sceneName)

					if (scene) {
						const enabled = scene.find((item) => item.sceneItemEnabled === true)
						if (enabled) {
							return true
						}
					}
				} else {
					const match = self.obsState.findSceneItemByName(sceneName, sourceName)
					if (match) {
						return match.item.sceneItemEnabled
					}
				}
				return false
			},
		},

		filter_enabled: {
			type: 'boolean',
			name: 'Filter - Enabled',
			description: 'If a specific filter is enabled on a source, change the style of the button',
			defaultStyle: styleActive(),
			options: [
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Source',
					id: 'source',
					default: self.obsState.sourceListDefault,
					choices: self.obsState.sourceChoicesWithScenes,
				},
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Filter',
					id: 'filter',
					default: self.obsState.filterListDefault,
					choices: self.obsState.filterList,
				},
			],
			callback: (feedback) => {
				const sourceName = feedback.options.source
				const sourceFilters = self.obsState.findSourceFiltersByName(sourceName)
				if (sourceFilters) {
					const filter = sourceFilters.find((item) => item.filterName === feedback.options.filter)
					return !!filter?.filterEnabled
				}
				return false
			},
		},
	}
}
