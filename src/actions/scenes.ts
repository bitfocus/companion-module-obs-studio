import { CompanionActionDefinitions, createModuleLogger } from '@companion-module/base'
import type OBSInstance from '../main.js'

const logger = createModuleLogger('Actions/Scenes')

export type SceneActionSchemas = {
	set_scene: { options: { scene: string } }
	preview_scene: { options: { scene: string } }
	smart_switcher: { options: { scene: string } }
	adjustPreviewScene: { options: { adjust: 'next' | 'previous' } }
}

export function getSceneActions(self: OBSInstance): CompanionActionDefinitions<SceneActionSchemas> {
	return {
		set_scene: {
			name: 'Set Program Scene',
			description: 'Switches the current program output to the specified scene',
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
			callback: async (action) => {
				await self.obs.sendRequest('SetCurrentProgramScene', { sceneName: action.options.scene })
			},
			learn: () => {
				if (!self.states.programScene) return undefined
				return { scene: self.states.programScene }
			},
		},

		preview_scene: {
			name: 'Set Preview Scene',
			description: 'Sets the specified scene as the current preview scene (Studio Mode only)',
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
			callback: async (action) => {
				await self.obs.sendRequest('SetCurrentPreviewScene', { sceneName: action.options.scene })
			},
			learn: () => {
				if (!self.states.previewScene) return undefined
				return { scene: self.states.previewScene }
			},
		},

		smart_switcher: {
			name: 'Smart Scene Switcher',
			description: 'Preview a scene, or transition it if it is already in preview',
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
			callback: async (action) => {
				const sceneName = action.options.scene

				if (self.states.previewScene === sceneName && self.states.programScene !== sceneName) {
					await self.obs.sendRequest('TriggerStudioModeTransition')
				} else {
					await self.obs.sendRequest('SetCurrentPreviewScene', { sceneName: sceneName })
				}
			},
			learn: () => {
				if (!self.states.previewScene) return undefined
				return { scene: self.states.previewScene }
			},
		},

		adjustPreviewScene: {
			name: 'Adjust Preview Scene',
			description: 'Moves the preview selection to the next or previous scene in the list',
			options: [
				{
					type: 'dropdown',
					disableAutoExpression: true,
					label: 'Adjust',
					id: 'adjust',
					default: 'next',
					choices: [
						{ id: 'next', label: 'Next' },
						{ id: 'previous', label: 'Previous' },
					],
				},
			],
			callback: async (action) => {
				const previewScene = self.obsState.findSceneByName(self.states.previewScene)
				const previewSceneIndex = previewScene?.sceneIndex ?? 0

				if (action.options.adjust === 'previous') {
					const previousIndex = previewSceneIndex + 1
					const previousScene = Array.from(self.states.scenes.values()).find((s) => s.sceneIndex === previousIndex)
					if (previousScene) {
						await self.obs.sendRequest('SetCurrentPreviewScene', { sceneName: previousScene.sceneName })
					} else {
						logger.debug('No previous scene found or already at the top of the list.')
					}
				} else if (action.options.adjust === 'next') {
					const nextIndex = previewSceneIndex - 1
					const nextScene = Array.from(self.states.scenes.values()).find((s) => s.sceneIndex === nextIndex)
					if (nextScene) {
						await self.obs.sendRequest('SetCurrentPreviewScene', { sceneName: nextScene.sceneName })
					} else {
						logger.debug('No next scene found or already at the bottom of the list.')
					}
				}
			},
		},
	}
}
