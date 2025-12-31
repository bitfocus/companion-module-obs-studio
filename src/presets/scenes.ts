import { CompanionPresetDefinitions } from '@companion-module/base'
import { Color } from '../utils.js'
import type { OBSInstance } from '../main.js'

export function getScenePresets(self: OBSInstance): CompanionPresetDefinitions {
	const presets: CompanionPresetDefinitions = {}

	for (const scene of self.obsState.sceneChoices) {
		presets[`toProgram_${scene.id}`] = {
			type: 'button',
			category: 'Scene to Program',
			name: scene.label,
			style: {
				text: scene.label,
				size: 'auto',
				color: Color.White,
				bgcolor: Color.Black,
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'set_scene',
							options: {
								scene: scene.id,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'sceneProgram',
					options: {
						scene: scene.id,
					},
					style: {
						bgcolor: Color.Red,
						color: Color.White,
					},
				},
			],
		}

		presets[`toPreview_${scene.id}`] = {
			type: 'button',
			category: 'Scene to Preview',
			name: scene.label,
			style: {
				text: scene.label,
				size: 'auto',
				color: Color.White,
				bgcolor: Color.Black,
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'preview_scene',
							options: {
								scene: scene.id,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'scenePreview',
					options: {
						scene: scene.id,
					},
					style: {
						bgcolor: Color.Green,
						color: Color.White,
					},
				},
			],
		}
	}

	return presets
}
