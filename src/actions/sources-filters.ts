import { CompanionActionDefinitions } from '@companion-module/base'
import type { OBSInstance } from '../main.js'

export function getSourcesFiltersActions(self: OBSInstance): CompanionActionDefinitions {
	const actions: CompanionActionDefinitions = {}

	actions['set_source_settings'] = {
		name: 'Set Source Settings',
		description: 'Sets the settings for a specific source (e.g., text for a text source)',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.sourceListDefault,
				choices: self.obsState.sourceChoices,
			},
			{
				type: 'textinput',
				label: 'New Text',
				id: 'text',
				default: '',
				useVariables: true,
			},
		],
		callback: async (action) => {
			let newText = action.options.text as string
			if (typeof newText === 'string') {
				newText = newText.replace(/\\n/g, '\n')
			}
			await self.obs.sendRequest('SetInputSettings', {
				inputUuid: action.options.source as string,
				inputSettings: { text: newText },
			})
		},
	}

	actions['setTextGDIPlus'] = {
		name: 'Set Source Settings (Text GDI+)',
		description: 'Detailed settings for Text (GDI+) sources, including font and file support',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.sourceListDefault,
				choices: self.obsState.sourceChoices,
			},
			{
				type: 'textinput',
				label: 'Text',
				id: 'text',
				default: '',
				useVariables: true,
			},
			{
				type: 'checkbox',
				label: 'Use File',
				id: 'useFile',
				default: false,
			},
			{
				type: 'textinput',
				label: 'File Path',
				id: 'file',
				default: '',
				useVariables: true,
				isVisibleExpression: `$(options:useFile)`,
			},
			{
				type: 'textinput',
				label: 'Font',
				id: 'font',
				default: '',
				useVariables: true,
			},
			{
				type: 'number',
				label: 'Font Size',
				id: 'size',
				default: 12,
				min: 1,
				max: 1000,
				range: false,
			},
			{
				type: 'textinput',
				label: 'Font Style',
				id: 'style',
				default: '',
				useVariables: true,
			},
			{
				type: 'checkbox',
				label: 'Update Font',
				id: 'updateFont',
				default: false,
			},
		],
		callback: async (action) => {
			const sourceUuid = action.options.source as string
			const inputSettings: any = {}

			if (action.options.text) {
				let newText = action.options.text as string
				if (typeof newText === 'string') {
					newText = newText.replace(/\\n/g, '\n')
				}
				inputSettings.text = newText
			}

			if (action.options.useFile) {
				inputSettings.read_from_file = true
				inputSettings.file = action.options.file as string
			} else {
				inputSettings.read_from_file = false
			}

			const existingFont = self.states.sources.get(sourceUuid)?.settings?.font
			if (action.options.updateFont) {
				inputSettings.font = {
					face: action.options.font as string,
					size: action.options.size as number,
					style: action.options.style as string,
				}
			} else if (
				existingFont &&
				existingFont.face !== undefined &&
				existingFont.size !== undefined &&
				existingFont.style !== undefined
			) {
				inputSettings.font = existingFont
			}
			await self.obs.sendRequest('SetInputSettings', {
				inputUuid: sourceUuid,
				inputSettings: inputSettings,
			})
		},
	}

	actions['set_filter_visible'] = {
		name: 'Set Filter Visibility',
		description: 'Shows, hides, or toggles the enabled state of a filter on a source',
		options: [
			{
				type: 'checkbox',
				label: 'All Sources',
				id: 'allSources',
				default: false,
			},
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.sourceListDefault,
				choices: self.obsState.sourceChoicesWithScenes,
				isVisibleExpression: `!$(options:allSources)`,
			},
			{
				type: 'dropdown',
				label: 'Filter',
				id: 'filter',
				default: self.obsState.filterListDefault,
				choices: self.obsState.filterList,
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
			const filterName = action.options.filter as string

			if (action.options.allSources) {
				const requests: any[] = []
				self.states.sourceFilters.forEach((filters, sourceUuid) => {
					const filter = filters.find((f: any) => f.filterName === filterName)
					if (filter) {
						let filterVisibility: boolean
						if (action.options.visible === 'toggle') {
							filterVisibility = !filter.filterEnabled
						} else {
							filterVisibility = action.options.visible == 'true' ? true : false
						}
						requests.push({
							requestType: 'SetSourceFilterEnabled',
							requestData: {
								sourceUuid: sourceUuid,
								filterName: filterName,
								filterEnabled: filterVisibility,
							},
						})
					}
				})

				await self.obs.sendBatch(requests)
			} else {
				const sourceUuid = action.options.source as string
				let filterVisibility: boolean
				if (action.options.visible === 'toggle') {
					const filters = self.states.sourceFilters.get(sourceUuid)
					const filter = filters?.find((f) => f.filterName === filterName)
					if (filter) {
						filterVisibility = !filter.filterEnabled
					} else {
						return
					}
				} else {
					filterVisibility = action.options.visible == 'true' ? true : false
				}

				await self.obs.sendRequest('SetSourceFilterEnabled', {
					sourceUuid: sourceUuid,
					filterName: filterName,
					filterEnabled: filterVisibility,
				})
			}
		},
	}

	actions['set_filter_settings'] = {
		name: 'Set Filter Settings',
		description: 'Sets the settings for a filter using a JSON object',
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
			{
				type: 'textinput',
				label: 'Settings (JSON)',
				id: 'settings',
				default: '{}',
				useVariables: true,
			},
		],
		callback: async (action) => {
			try {
				const settings = action.options.settings as string
				const settingsJSON = JSON.parse(settings)
				await self.obs.sendRequest('SetSourceFilterSettings', {
					sourceUuid: action.options.source as string,
					filterName: action.options.filter as string,
					filterSettings: settingsJSON,
				})
			} catch (e: any) {
				self.log('error', `Set Filter Settings Error: ${e.message}`)
			}
		},
	}

	actions['refresh_browser_source'] = {
		name: 'Refresh Browser Source',
		description: 'Refreshes the cache of a specific browser source',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.sourceListDefault,
				choices: self.obsState.sourceChoices,
			},
		],
		callback: async (action) => {
			const sourceUuid = action.options.source as string
			if (self.states.sources.get(sourceUuid)?.inputKind == 'browser_source') {
				await self.obs.sendRequest('PressInputPropertiesButton', {
					inputUuid: sourceUuid,
					propertyName: 'refreshnocache',
				})
			}
		},
	}

	actions['take_screenshot'] = {
		name: 'Take Screenshot',
		description: 'Saves a screenshot of a specific source or scene to disk',
		options: [
			{
				type: 'checkbox',
				label: 'Current Program Scene',
				id: 'useProgramScene',
				default: false,
			},
			{
				type: 'checkbox',
				label: 'Current Preview Scene',
				id: 'usePreviewScene',
				default: false,
				isVisibleExpression: `!$(options:useProgramScene)`,
			},
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.sourceListDefault,
				choices: self.obsState.sourceChoices,
				isVisibleExpression: `!$(options:useProgramScene) && !$(options:usePreviewScene)`,
			},
			{
				type: 'dropdown',
				label: 'Format',
				id: 'format',
				default: 'png',
				choices: self.states.imageFormats,
			},
			{
				type: 'number',
				label: 'Compression Quality (Default: -1/0)',
				description: 'PNG: 0-9. JPG: 0-100. -1 or 0 for default.',
				id: 'compression',
				default: 0,
				min: -1,
				max: 100,
				range: false,
			},
			{
				type: 'checkbox',
				label: 'Custom Path',
				id: 'customName',
				default: false,
			},
			{
				type: 'textinput',
				label: 'Path (including filename)',
				id: 'path',
				default: '',
				useVariables: true,
				isVisibleExpression: `$(options:customName)`,
			},
			{
				type: 'textinput',
				label: 'Prefix (for default path)',
				id: 'prefix',
				default: 'Screenshot ',
				useVariables: true,
				isVisibleExpression: `!$(options:customName)`,
			},
		],
		callback: async (action) => {
			let sourceUuid: string
			if (action.options.useProgramScene) {
				sourceUuid = self.states.programSceneUuid
			} else if (action.options.usePreviewScene) {
				sourceUuid = self.states.previewSceneUuid
			} else {
				sourceUuid = action.options.source as string
			}

			let filePath
			if (action.options.customName) {
				filePath = action.options.path as string
			} else {
				const prefix = action.options.prefix as string
				filePath = `${self.states.recordDirectory}/${prefix}${new Date().getTime()}.${action.options.format}`
			}

			const quality = action.options.compression == 0 ? -1 : action.options.compression

			await self.obs.sendRequest('SaveSourceScreenshot', {
				sourceUuid: sourceUuid,
				imageFormat: action.options.format as string,
				imageFilePath: filePath,
				imageCompressionQuality: quality as number,
			})
		},
	}

	actions['set_scene_item_properties'] = {
		name: 'Set Scene Item Properties',
		description: 'Sets the transform properties (position, scale, rotation) of a scene item',
		options: [
			{
				type: 'checkbox',
				label: 'Current Program Scene',
				id: 'useProgramScene',
				default: true,
			},
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: self.obsState.sceneListDefault,
				choices: self.obsState.sceneChoices,
				isVisibleExpression: `!$(options:useProgramScene)`,
			},
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.sourceListDefault,
				choices: self.obsState.sourceChoices,
			},
			{
				type: 'textinput',
				label: 'Position X',
				id: 'positionX',
				default: '',
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Position Y',
				id: 'positionY',
				default: '',
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Scale X',
				id: 'scaleX',
				default: '',
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Scale Y',
				id: 'scaleY',
				default: '',
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Rotation',
				id: 'rotation',
				default: '',
				useVariables: true,
			},
		],
		callback: async (action) => {
			const sourceSceneUuid = action.options.useProgramScene
				? self.states.programSceneUuid
				: (action.options.scene as string)
			const sourceUuid = action.options.source as string

			const transform: { [key: string]: number } = {}
			if (action.options.positionX) transform.positionX = Number(action.options.positionX as string)
			if (action.options.positionY) transform.positionY = Number(action.options.positionY as string)
			if (action.options.scaleX) transform.scaleX = Number(action.options.scaleX as string)
			if (action.options.scaleY) transform.scaleY = Number(action.options.scaleY as string)
			if (action.options.rotation) transform.rotation = Number(action.options.rotation as string)

			try {
				const sourceName = self.states.sources.get(sourceUuid)?.sourceName || sourceUuid
				const sceneItem = await self.obs.sendRequest('GetSceneItemId', {
					sceneUuid: sourceSceneUuid,
					sourceName: sourceName,
				})

				if (sceneItem?.sceneItemId) {
					await self.obs.sendRequest('SetSceneItemTransform', {
						sceneUuid: sourceSceneUuid,
						sceneItemId: sceneItem?.sceneItemId,
						sceneItemTransform: transform,
					})
				} else {
					self.log('warn', `Scene item not found for source: ${sourceUuid} in scene: ${sourceSceneUuid}`)
					return
				}
			} catch (e: any) {
				self.log('error', `Set Scene Item Properties Error: ${e.message}`)
			}
		},
	}

	return actions
}
