import { CompanionActionDefinitions } from '@companion-module/base'
import type { OBSInstance } from '../main.js'

export function getSceneActions(self: OBSInstance): CompanionActionDefinitions {
	const actions: CompanionActionDefinitions = {}

	actions['set_scene'] = {
		name: 'Set Program Scene',
		description: 'Switches the current program output to the specified scene',
		options: [
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: self.obsState.sceneListDefault,
				choices: self.obsState.sceneChoices,
				isVisibleExpression: '!$(options:custom)',
			},
			{
				type: 'checkbox',
				label: 'Use Custom Name',
				id: 'custom',
				default: false,
			},
			{
				type: 'textinput',
				label: 'Custom Scene Name',
				id: 'customSceneName',
				default: '',
				useVariables: true,
				isVisibleExpression: '$(options:custom)',
			},
		],
		callback: async (action) => {
			if (action.options.custom) {
				const scene = action.options.customSceneName as string
				await self.obs.sendRequest('SetCurrentProgramScene', { sceneName: scene })
			} else {
				await self.obs.sendRequest('SetCurrentProgramScene', { sceneUuid: action.options.scene as string })
			}
		},
	}

	actions['preview_scene'] = {
		name: 'Set Preview Scene',
		description: 'Sets the specified scene as the current preview scene (Studio Mode only)',
		options: [
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: self.obsState.sceneListDefault,
				choices: self.obsState.sceneChoices,
				isVisibleExpression: '!$(options:custom)',
			},
			{
				type: 'checkbox',
				label: 'Use Custom Name',
				id: 'custom',
				default: false,
			},
			{
				type: 'textinput',
				label: 'Custom Scene Name',
				id: 'customSceneName',
				default: '',
				useVariables: true,
				isVisibleExpression: '$(options:custom)',
			},
		],
		callback: async (action) => {
			if (action.options.custom) {
				const scene = action.options.customSceneName as string
				await self.obs.sendRequest('SetCurrentPreviewScene', { sceneName: scene })
			} else {
				await self.obs.sendRequest('SetCurrentPreviewScene', { sceneUuid: action.options.scene as string })
			}
		},
	}

	actions['smart_switcher'] = {
		name: 'Smart Scene Switcher',
		description: 'Preview a scene, or transition it if it is already in preview',
		options: [
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: self.obsState.sceneListDefault,
				choices: self.obsState.sceneChoices,
				isVisibleExpression: '!$(options:custom)',
			},
			{
				type: 'checkbox',
				label: 'Use Custom Name',
				id: 'custom',
				default: false,
			},
			{
				type: 'textinput',
				useVariables: true,
				label: 'Custom Scene Name',
				id: 'customSceneName',
				default: '',
				isVisibleExpression: '$(options:custom)',
			},
		],
		callback: async (action) => {
			const sceneUuid = action.options.scene as string

			if (action.options.custom) {
				const scene = action.options.customSceneName as string
				if (self.states.previewScene === scene && self.states.programScene !== scene) {
					await self.obs.sendRequest('TriggerStudioModeTransition')
				} else {
					await self.obs.sendRequest('SetCurrentPreviewScene', { sceneName: scene })
				}
			} else {
				if (self.states.previewSceneUuid === sceneUuid && self.states.programSceneUuid !== sceneUuid) {
					await self.obs.sendRequest('TriggerStudioModeTransition')
				} else {
					await self.obs.sendRequest('SetCurrentPreviewScene', { sceneUuid: sceneUuid })
				}
			}
		},
	}

	actions['adjustPreview_scene'] = {
		name: 'Adjust Preview Scene',
		description: 'Moves the preview selection to the next or previous scene in the list',
		options: [
			{
				type: 'dropdown',
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
			const previewSceneUuid = self.states.previewSceneUuid
			const previewSceneIndex = self.states.scenes.get(previewSceneUuid)?.sceneIndex ?? 0

			if (action.options.adjust === 'previous') {
				const previousIndex = previewSceneIndex + 1 // Assuming higher index means "previous" in the list order
				const previousScene = Array.from(self.states.scenes.values()).find((s) => s.sceneIndex === previousIndex)
				if (previousScene) {
					await self.obs.sendRequest('SetCurrentPreviewScene', { sceneUuid: previousScene.sceneUuid })
				} else {
					self.log('debug', 'No previous scene found or already at the top of the list.')
				}
			} else if (action.options.adjust === 'next') {
				const nextIndex = previewSceneIndex - 1 // Assuming lower index means "next" in the list order
				const nextScene = Array.from(self.states.scenes.values()).find((s) => s.sceneIndex === nextIndex)
				if (nextScene) {
					await self.obs.sendRequest('SetCurrentPreviewScene', { sceneUuid: nextScene.sceneUuid })
				} else {
					self.log('debug', 'No next scene found or already at the bottom of the list.')
				}
			}
		},
	}

	return actions
}
