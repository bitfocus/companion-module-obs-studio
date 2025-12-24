import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type { OBSInstance } from '../main.js'
import { Color } from '../utils.js'

export function getScenesSourcesFiltersFeedbacks(self: OBSInstance): CompanionFeedbackDefinitions {
	const feedbacks: CompanionFeedbackDefinitions = {}

	feedbacks['scene_active'] = {
		type: 'advanced',
		name: 'Scene in Preview / Program',
		description: 'If a scene is in preview or program, change colors of the button. Useful for tally.',
		options: [
			{
				type: 'dropdown',
				label: 'Mode',
				id: 'mode',
				default: 'programAndPreview',
				choices: [
					{ id: 'programAndPreview', label: 'Program and Preview' },
					{ id: 'program', label: 'Program Only' },
					{ id: 'preview', label: 'Preview Only' },
				],
			},
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: self.obsState.sceneListDefault,
				choices: self.obsState.sceneChoices,
				allowCustom: true,
			},
			{
				type: 'colorpicker',
				label: 'Foreground color (Program)',
				id: 'fg',
				default: Color.White,
			},
			{
				type: 'colorpicker',
				label: 'Background color (Program)',
				id: 'bg',
				default: Color.Red,
			},
			{
				type: 'colorpicker',
				label: 'Foreground color (Preview)',
				id: 'fg_preview',
				default: Color.White,
			},
			{
				type: 'colorpicker',
				label: 'Background color (Preview)',
				id: 'bg_preview',
				default: Color.Green,
			},
		],
		callback: (feedback) => {
			let mode = feedback.options.mode
			const sceneUuid = feedback.options.scene as string
			if (!mode) {
				mode = 'programAndPreview'
			}
			if (self.states.programSceneUuid === sceneUuid && (mode === 'programAndPreview' || mode === 'program')) {
				return { color: feedback.options.fg as number, bgcolor: feedback.options.bg as number }
			} else if (
				self.states.previewSceneUuid === sceneUuid &&
				self.states.studioMode === true &&
				(mode === 'programAndPreview' || mode === 'preview')
			) {
				return { color: feedback.options.fg_preview as number, bgcolor: feedback.options.bg_preview as number }
			} else {
				return {}
			}
		},
	}

	feedbacks['sceneProgram'] = {
		type: 'boolean',
		name: 'Scene in Program',
		description: 'If a scene is in the program output, change the style of the button',
		defaultStyle: {
			color: Color.White,
			bgcolor: Color.Red,
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
		],
		callback: (feedback) => {
			const sceneUuid = feedback.options.scene as string
			return self.states.programSceneUuid === sceneUuid
		},
	}

	feedbacks['scenePreview'] = {
		type: 'boolean',
		name: 'Scene in Preview',
		description: 'If a scene is in the preview monitor (Studio Mode only), change the style of the button',
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
		],
		callback: (feedback) => {
			const sceneUuid = feedback.options.scene as string
			return self.states.previewSceneUuid === sceneUuid
		},
	}

	feedbacks['scenePrevious'] = {
		type: 'boolean',
		name: 'Previous Scene Active',
		description: 'If a scene was the last scene previously active, change the style of the button',
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
		],
		callback: (feedback) => {
			return self.states.previousSceneUuid === (feedback.options.scene as string)
		},
	}

	feedbacks['scene_item_active'] = {
		type: 'boolean',
		name: 'Source Visible in Program',
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
				isVisible: (options) => !options.anyScene,
			},
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: self.obsState.sceneListDefault,
				choices: self.obsState.sceneChoices,
				isVisible: (options) => !options.anyScene && !options.useCurrentScene,
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
		name: 'Source Active in Preview',
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
		name: 'Source Enabled in Scene',
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
				isVisible: (options) => !options.any,
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
		name: 'Filter Enabled',
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
