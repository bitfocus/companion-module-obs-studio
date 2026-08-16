import { CompanionActionDefinitions, createModuleLogger } from '@companion-module/base'
import type OBSInstance from '../main.js'

const logger = createModuleLogger('Actions/Scenes')

export type SceneActionSchemas = {
	set_scene: { options: { scene: string } }
	preview_scene: { options: { mode: 'set' | 'next' | 'previous'; scene: string } }
	smart_switcher: { options: { scene: string } }
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
			description:
				'Sets the current preview scene, either directly or by moving through the scene list (Studio Mode only)',
			options: [
				{
					type: 'dropdown',
					disableAutoExpression: true,
					label: 'Mode',
					id: 'mode',
					default: 'set',
					choices: [
						{ id: 'set', label: 'Set Scene' },
						{ id: 'next', label: 'Next Scene' },
						{ id: 'previous', label: 'Previous Scene' },
					],
				},
				{
					type: 'dropdown',
					label: 'Scene',
					id: 'scene',
					default: self.obsState.sceneListDefault,
					choices: self.obsState.sceneChoices,
					allowCustom: true,
					isVisibleExpression: `$(options:mode) === 'set'`,
				},
			],
			callback: async (action) => {
				if (action.options.mode === 'set') {
					await self.obs.sendRequest('SetCurrentPreviewScene', { sceneName: action.options.scene })
					return
				}

				const previewScene = self.obsState.findSceneByName(self.states.previewScene)
				const previewSceneIndex = previewScene?.sceneIndex ?? 0

				// OBS orders scenes bottom-up, so the "next" scene in the UI is the lower index.
				const targetIndex = action.options.mode === 'next' ? previewSceneIndex - 1 : previewSceneIndex + 1
				const targetScene = Array.from(self.states.scenes.values()).find((s) => s.sceneIndex === targetIndex)
				if (targetScene) {
					await self.obs.sendRequest('SetCurrentPreviewScene', { sceneName: targetScene.sceneName })
				} else {
					logger.debug(`No ${action.options.mode} scene found or already at the end of the list.`)
				}
			},
			learn: () => {
				if (!self.states.previewScene) return undefined
				return { mode: 'set', scene: self.states.previewScene }
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
	}
}
