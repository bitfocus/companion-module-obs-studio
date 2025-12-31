import { CompanionActionDefinitions } from '@companion-module/base'
import type { OBSInstance } from '../main.js'

export function getScenesSceneItemsActions(self: OBSInstance): CompanionActionDefinitions {
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
			const sceneUuid = action.options.scene as string

			if (self.states.previewSceneUuid === sceneUuid && self.states.programSceneUuid !== sceneUuid) {
				await self.obs.sendRequest('TriggerStudioModeTransition')
			} else {
				await self.obs.sendRequest('SetCurrentPreviewScene', { sceneUuid: sceneUuid })
			}
		},
	}

	actions['adjust_preview_scene'] = {
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
					self.log('debug', 'No previous scene found or already at the end of the list.')
				}
			} else if (action.options.adjust === 'next') {
				const nextIndex = previewSceneIndex - 1 // Assuming lower index means "next" in the list order
				const nextScene = Array.from(self.states.scenes.values()).find((s) => s.sceneIndex === nextIndex)
				if (nextScene) {
					await self.obs.sendRequest('SetCurrentPreviewScene', { sceneUuid: nextScene.sceneUuid })
				} else {
					self.log('debug', 'No next scene found or already at the beginning of the list.')
				}
			}
		},
	}

	actions['reorder_scene_item'] = {
		name: 'Reorder Scene Item',
		description: 'Changes the position (layering) of an item within a scene',
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
				sceneUuid: action.options.scene as string,
				sceneItemId: action.options.source as number,
				sceneItemIndex: action.options.pos as number,
			})
		},
	}

	actions['set_source_visible'] = {
		name: 'Source - Set Visibility',
		description: 'Shows, hides, or toggles the visibility of an item in the specified scene(s)',
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
				isVisibleExpression: '!$(options:anyScene)',
			},
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: self.obsState.sceneListDefault,
				choices: self.obsState.sceneChoices,
				isVisibleExpression: '!$(options:anyScene) &&!$(options:useCurrentScene)',
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
			const sourceUuid = action.options.source as string
			const sources: any[] = []

			if (action.options.anyScene) {
				for (const [sceneUuid, sceneItems] of self.states.sceneItems) {
					const item = sceneItems.find((i: any) => i.sourceUuid === sourceUuid)
					if (item) {
						sources.push({
							sceneUuid: sceneUuid,
							sceneItemId: item.sceneItemId,
						})
					}
				}
				for (const [groupUuid, groupItems] of self.states.groups) {
					const item = groupItems.find((i: any) => i.sourceUuid === sourceUuid)
					if (item) {
						sources.push({
							sceneUuid: groupUuid,
							sceneItemId: item.sceneItemId,
						})
					}
				}
			} else {
				const sceneUuid = action.options.useCurrentScene
					? self.states.programSceneUuid
					: (action.options.scene as string)
				const sceneItems = self.states.sceneItems.get(sceneUuid)
				const item = sceneItems?.find((i: any) => i.sourceUuid === sourceUuid)
				if (item) {
					sources.push({
						sceneUuid: sceneUuid,
						sceneItemId: item.sceneItemId,
					})
				} else {
					const groups = self.states.groups.get(sceneUuid)
					const item = groups?.find((i: any) => i.sourceUuid === sourceUuid)
					if (item) {
						sources.push({
							sceneUuid: sceneUuid,
							sceneItemId: item.sceneItemId,
						})
					}
				}
			}

			if (sources.length > 0) {
				const requests: any[] = []
				sources.forEach((source) => {
					let enabled: boolean
					if (action.options.visible === 'toggle') {
						const sceneItems = self.states.sceneItems.get(source.sceneUuid)
						const item = sceneItems?.find((i: any) => i.sceneItemId === source.sceneItemId)
						if (item) {
							enabled = !item.sceneItemEnabled
						} else {
							const groups = self.states.groups.get(source.sceneUuid)
							const item = groups?.find((i: any) => i.sceneItemId === source.sceneItemId)
							if (item) {
								enabled = !item.sceneItemEnabled
							} else {
								enabled = false
							}
						}
					} else {
						enabled = action.options.visible === 'true'
					}
					requests.push({
						requestType: 'SetSceneItemEnabled',
						requestData: {
							sceneUuid: source.sceneUuid,
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
