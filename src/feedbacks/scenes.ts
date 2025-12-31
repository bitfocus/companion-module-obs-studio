import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type { OBSInstance } from '../main.js'
import { Color } from '../utils.js'

export function getSceneFeedbacks(self: OBSInstance): CompanionFeedbackDefinitions {
	const feedbacks: CompanionFeedbackDefinitions = {}

	feedbacks['scene_active'] = {
		type: 'advanced',
		name: 'Scene - Preview / Program',
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
		name: 'Scene - Program',
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
		name: 'Scene - Preview',
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
		name: 'Scene - Previous',
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

	return feedbacks
}
