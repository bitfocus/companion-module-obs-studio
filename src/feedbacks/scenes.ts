import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { Color } from '../utils.js'

export type SceneFeedbackSchemas = {
	scene_active: {
		type: 'advanced'
		options: {
			mode: 'programAndPreview' | 'program' | 'preview'
			scene: string
			fg: number
			bg: number
			fg_preview: number
			bg_preview: number
		}
	}
	sceneProgram: { type: 'boolean'; options: { scene: string } }
	scenePreview: { type: 'boolean'; options: { scene: string } }
	scenePrevious: { type: 'boolean'; options: { scene: string } }
}

export function getSceneFeedbacks(self: OBSInstance): CompanionFeedbackDefinitions<SceneFeedbackSchemas> {
	return {
		scene_active: {
			type: 'advanced',
			name: 'Scene - Preview / Program',
			description: 'If a scene is in preview or program, change colors of the button. Useful for tally.',
			affectedProperties: ['color', 'bgcolor'],
			options: [
				{
					type: 'dropdown',
					disableAutoExpression: true,
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
				const sceneName = feedback.options.scene
				if (!mode) {
					mode = 'programAndPreview'
				}
				if (self.states.programScene === sceneName && (mode === 'programAndPreview' || mode === 'program')) {
					return { color: feedback.options.fg, bgcolor: feedback.options.bg }
				} else if (
					self.states.previewScene === sceneName &&
					self.states.studioMode === true &&
					(mode === 'programAndPreview' || mode === 'preview')
				) {
					return {
						color: feedback.options.fg_preview,
						bgcolor: feedback.options.bg_preview,
					}
				} else {
					return {}
				}
			},
		},

		sceneProgram: {
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
				const sceneName = feedback.options.scene
				return self.states.programScene === sceneName
			},
		},

		scenePreview: {
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
				const sceneName = feedback.options.scene
				return self.states.previewScene === sceneName
			},
		},

		scenePrevious: {
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
					allowCustom: true,
				},
			],
			callback: (feedback) => {
				const sceneName = feedback.options.scene
				return self.states.previousScene === sceneName
			},
		},
	}
}
