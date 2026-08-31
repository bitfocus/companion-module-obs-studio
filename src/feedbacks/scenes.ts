import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { stylePreview, styleProgram } from '../presets/style.js'
import { choiceDropdown } from '../actions/options.js'

export type SceneFeedbackSchemas = {
	sceneProgram: { type: 'boolean'; options: { scene: string } }
	scenePreview: { type: 'boolean'; options: { scene: string } }
	scenePrevious: { type: 'boolean'; options: { scene: string } }
}

export function getSceneFeedbacks(self: OBSInstance): CompanionFeedbackDefinitions<SceneFeedbackSchemas> {
	return {
		sceneProgram: {
			type: 'boolean',
			name: 'Scene - Program',
			description: 'If a scene is in the program output, change the style of the button',
			defaultStyle: styleProgram(),
			options: [choiceDropdown(self, 'scene', { id: 'scene', label: 'Scene' })],
			callback: (feedback) => {
				const sceneName = feedback.options.scene
				return self.states.programScene === sceneName
			},
		},

		scenePreview: {
			type: 'boolean',
			name: 'Scene - Preview',
			description: 'If a scene is in the preview monitor (Studio Mode only), change the style of the button',
			defaultStyle: stylePreview(),
			options: [choiceDropdown(self, 'scene', { id: 'scene', label: 'Scene' })],
			callback: (feedback) => {
				const sceneName = feedback.options.scene
				return self.states.previewScene === sceneName
			},
		},

		scenePrevious: {
			type: 'boolean',
			name: 'Scene - Previous',
			description: 'If a scene was the last scene previously active, change the style of the button',
			defaultStyle: stylePreview(),
			options: [choiceDropdown(self, 'scene', { id: 'scene', label: 'Scene' })],
			callback: (feedback) => {
				const sceneName = feedback.options.scene
				return self.states.previousScene === sceneName
			},
		},
	}
}
