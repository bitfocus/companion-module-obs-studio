import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { styleActive, stylePreview, styleProgram } from '../presets/style.js'
import { choiceDropdown } from '../actions/options.js'

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
					disableAutoExpression: true,
					label: 'All Scenes',
					id: 'anyScene',
					default: true,
				},
				{
					type: 'checkbox',
					disableAutoExpression: true,
					label: 'Current Scene',
					id: 'useCurrentScene',
					default: false,
					isVisibleExpression: `!$(options:anyScene)`,
				},
				choiceDropdown(self, 'scene', {
					id: 'scene',
					label: 'Scene',
					isVisibleExpression: `!$(options:anyScene) && !$(options:useCurrentScene)`,
				}),
				choiceDropdown(self, 'source', { id: 'source', label: 'Source' }),
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
			options: [choiceDropdown(self, 'source', { id: 'source', label: 'Source name' })],
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
				choiceDropdown(self, 'scene', { id: 'scene', label: 'Scene' }),
				{
					type: 'checkbox',
					disableAutoExpression: true,
					label: 'Any Source',
					id: 'any',
					default: false,
				},
				choiceDropdown(self, 'source', { id: 'source', label: 'Source', isVisibleExpression: `!$(options:any)` }),
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
					// A source can sit in the scene more than once; the button lights while any copy is on.
					const matches = self.obsState.findSceneItemsByNameInScene(sceneName, sourceName)
					return matches.some((match) => match.item.sceneItemEnabled)
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
				choiceDropdown(self, 'sourceWithScenes', { id: 'source', label: 'Source' }),
				choiceDropdown(self, 'filter', { id: 'filter', label: 'Filter' }),
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
