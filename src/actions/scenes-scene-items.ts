import { CompanionActionDefinitions } from '@companion-module/base'
import type { OBSInstance } from '../main.js'

export function getScenesSceneItemsActions(self: OBSInstance): CompanionActionDefinitions {
	const actions: CompanionActionDefinitions = {}

	actions['set_scene'] = {
		name: 'Set Program Scene',
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
				type: 'textinput',
				label: 'Custom Scene Name',
				id: 'customSceneName',
				default: '',
				useVariables: true,
				isVisible: (options) => options.scene === 'custom',
			},
		],
		callback: async (action) => {
			if (action.options.scene === 'custom') {
				const scene = action.options.customSceneName as string
				await self.obs.sendRequest('SetCurrentProgramScene', { sceneName: scene })
			} else {
				await self.obs.sendRequest('SetCurrentProgramScene', { sceneName: action.options.scene })
			}
		},
	}

	actions['preview_scene'] = {
		name: 'Set Preview Scene',
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
				type: 'textinput',
				label: 'Custom Scene Name',
				id: 'customSceneName',
				default: '',
				useVariables: true,
				isVisible: (options) => options.scene === 'custom',
			},
			{
				type: 'checkbox',
				label: 'Revert to previous scene after transition',
				id: 'revert',
				default: false,
			},
		],
		callback: async (action) => {
			if (action.options.scene === 'custom') {
				const scene = action.options.customSceneName as string
				await self.obs.sendRequest('SetCurrentPreviewScene', { sceneName: scene })
			} else {
				await self.obs.sendRequest('SetCurrentPreviewScene', { sceneName: action.options.scene })
			}

			if (action.options.revert && self.states.programScene !== undefined) {
				const revertTransitionDuration =
					self.states.transitionDuration !== undefined ? Number(self.states.transitionDuration) : 0

				setTimeout(
					() => {
						void self.obs.sendRequest('SetCurrentPreviewScene', { sceneName: self.states.programScene })
					},
					(revertTransitionDuration ?? 0) + 50,
				)
			}
		},
	}

	actions['smart_preview_scene'] = {
		name: 'Smart Preview Scene',
		description: 'Preview a scene, or transition it if it is already in preview',
		options: [
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: self.obsState.sceneListDefault,
				choices: self.obsState.sceneChoices,
			},
		],
		callback: async (action) => {
			const scene = action.options.scene as string

			if (self.states.previewScene == scene && self.states.programScene != scene) {
				await self.obs.sendRequest('TriggerStudioModeTransition')
			} else {
				await self.obs.sendRequest('SetCurrentPreviewScene', { sceneName: scene })
			}
		},
	}

	actions['adjust_preview_scene'] = {
		name: 'Adjust Preview Scene',
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
			const previewScene = self.states.previewScene
			const previewSceneIndex = self.states.scenes.get(previewScene)?.sceneIndex ?? 0

			if (action.options.adjust === 'previous') {
				const previousIndex = previewSceneIndex + 1 // Assuming higher index means "previous" in the list order
				const previousScene = Array.from(self.states.scenes.values()).find((s) => s.sceneIndex === previousIndex)
				if (previousScene) {
					await self.obs.sendRequest('SetCurrentPreviewScene', { sceneName: previousScene.sceneName })
				} else {
					self.log('debug', 'No previous scene found or already at the end of the list.')
				}
			} else if (action.options.adjust === 'next') {
				const nextIndex = previewSceneIndex - 1 // Assuming lower index means "next" in the list order
				const nextScene = Array.from(self.states.scenes.values()).find((s) => s.sceneIndex === nextIndex)
				if (nextScene) {
					await self.obs.sendRequest('SetCurrentPreviewScene', { sceneName: nextScene.sceneName })
				} else {
					self.log('debug', 'No next scene found or already at the beginning of the list.')
				}
			}
		},
	}

	actions['set_source_mute'] = {
		name: 'Set Source Mute',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.audioSourceListDefault,
				choices: self.obsState.audioSourceList,
			},
			{
				type: 'dropdown',
				label: 'Mute',
				id: 'mute',
				default: 'true',
				choices: [
					{ id: 'true', label: 'Mute' },
					{ id: 'false', label: 'Unmute' },
				],
			},
		],
		callback: async (action) => {
			await self.obs.sendRequest('SetInputMute', {
				inputName: action.options.source as string,
				inputMuted: action.options.mute == 'true' ? true : false,
			})
		},
	}

	actions['reorder_scene_item'] = {
		name: 'Reorder Scene Item',
		options: [
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: self.obsState.sceneListDefault,
				choices: self.obsState.sceneChoices,
			},
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.sourceListDefault,
				choices: self.obsState.sourceChoices,
			},
			{
				type: 'number',
				label: 'Position (Index)',
				id: 'pos',
				default: 0,
				min: 0,
				max: 100,
				range: false,
			},
		],
		callback: async (action) => {
			await self.obs.sendRequest('SetSceneItemIndex', {
				sceneName: action.options.scene as string,
				sceneItemId: action.options.source as number,
				sceneItemIndex: action.options.pos as number,
			})
		},
	}

	actions['set_source_visible'] = {
		name: 'Set Source Visibility',
		options: [
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: 'anyScene',
				choices: self.obsState.sceneChoicesAnyScene,
			},
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.sourceListDefault,
				choices: self.obsState.sourceChoices,
			},
			{
				type: 'dropdown',
				label: 'Visibility',
				id: 'visible',
				default: 'toggle',
				choices: [
					{ id: 'true', label: 'Show' },
					{ id: 'false', label: 'Hide' },
					{ id: 'toggle', label: 'Toggle' },
				],
			},
		],
		callback: async (action) => {
			const sourceName = action.options.source as string
			const sources = []
			if (action.options.scene === 'anyScene') {
				for (const [sceneName, sceneItems] of self.states.sceneItems) {
					const item = sceneItems.find((i: any) => i.sourceName === sourceName)
					if (item) {
						sources.push({
							sceneName: sceneName,
							sceneItemId: item.sceneItemId,
							groupName: sceneName,
						})
					}
				}
				for (const [groupName, groupItems] of self.states.groups) {
					const item = groupItems.find((i: any) => i.sourceName === sourceName)
					if (item) {
						sources.push({
							sceneName: groupName,
							sceneItemId: item.sceneItemId,
							groupName: groupName,
						})
					}
				}
			} else {
				const sceneItems = self.states.sceneItems.get(action.options.scene as string)
				const item = sceneItems?.find((i: any) => i.sourceName === sourceName)
				if (item) {
					sources.push({
						sceneName: action.options.scene as string,
						sceneItemId: item.sceneItemId,
						groupName: action.options.scene as string,
					})
				} else {
					const groups = self.states.groups.get(action.options.scene as string)
					const item = groups?.find((i: any) => i.sourceName === sourceName)
					if (item) {
						sources.push({
							sceneName: action.options.scene as string,
							sceneItemId: item.sceneItemId,
							groupName: action.options.scene as string,
						})
					}
				}
			}

			if (sources.length > 0) {
				const requests: any[] = []
				sources.forEach((source) => {
					let enabled: boolean
					if (action.options.visible === 'toggle') {
						const sceneItems = self.states.sceneItems.get(source.sceneName)
						const item = sceneItems?.find((i: any) => i.sceneItemId === source.sceneItemId)
						if (item) {
							enabled = !item.sceneItemEnabled
						} else {
							const groups = self.states.groups.get(source.groupName)
							const item = groups?.find((i: any) => i.sceneItemId === source.sceneItemId)
							if (item) {
								enabled = !item.sceneItemEnabled
							} else {
								enabled = false
							}
						}
					} else {
						enabled = action.options.visible == 'true' ? true : false
					}
					requests.push({
						requestType: 'SetSceneItemEnabled',
						requestData: {
							sceneName: source.groupName,
							sceneItemId: source.sceneItemId,
							sceneItemEnabled: enabled,
						},
					})
				})
				await self.obs.sendBatch(requests)
			}
		},
	}

	return actions
}
