import { CompanionActionDefinitions } from '@companion-module/base'
import type { OBSInstance } from '../main.js'

export function getSourcesFiltersActions(self: OBSInstance): CompanionActionDefinitions {
	const actions: CompanionActionDefinitions = {}

	actions['set_source_settings'] = {
		name: 'Set Source Settings',
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
				inputName: action.options.source as string,
				inputSettings: { text: newText },
			})
		},
	}

	actions['setTextGDIPlus'] = {
		name: 'Set Source Settings (Text GDI+)',
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
				isVisible: (options) => options.useFile === true,
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
			const source = action.options.source as string
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

			const existingFont = self.states.sources.get(source)?.settings?.font
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
				inputName: source,
				inputSettings: inputSettings,
			})
		},
	}

	actions['set_filter_visible'] = {
		name: 'Set Filter Visibility',
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
			const source = action.options.source as string
			const filterName = action.options.filter as string

			if (source === 'allSources') {
				const requests: any[] = []
				self.states.sourceFilters.forEach((filters, sourceName) => {
					const filter = filters.find((f: any) => f.filterName === filterName)
					if (filter) {
						let filterVisibility
						if (action.options.visible === 'toggle') {
							filterVisibility = !filter.filterEnabled
						} else {
							filterVisibility = action.options.visible == 'true' ? true : false
						}
						requests.push({
							requestType: 'SetSourceFilterEnabled',
							requestData: {
								sourceName: sourceName,
								filterName: filterName,
								filterEnabled: filterVisibility,
							},
						})
					}
				})

				await self.obs.sendBatch(requests)
			} else {
				let filterVisibility
				if (action.options.visible === 'toggle') {
					const filters = self.states.sourceFilters.get(source)
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
					sourceName: source,
					filterName: filterName,
					filterEnabled: filterVisibility,
				})
			}
		},
	}

	actions['set_filter_settings'] = {
		name: 'Set Filter Settings',
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
					sourceName: action.options.source,
					filterName: action.options.filter,
					filterSettings: settingsJSON,
				})
			} catch (e: any) {
				self.log('error', `Set Filter Settings Error: ${e.message}`)
			}
		},
	}

	actions['refresh_browser_source'] = {
		name: 'Refresh Browser Source',
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
			const sourceName = action.options.source as string
			if (self.states.sources.get(sourceName)?.inputKind == 'browser_source') {
				await self.obs.sendRequest('PressInputPropertiesButton', {
					inputName: sourceName,
					propertyName: 'refreshnocache',
				})
			}
		},
	}

	actions['take_screenshot'] = {
		name: 'Take Screenshot',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: 'programScene',
				choices: [
					{ id: 'programScene', label: 'Current Program Scene' },
					{ id: 'previewScene', label: 'Current Preview Scene' },
					...self.obsState.sourceChoices,
				],
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
				isVisible: (options) => options.customName === true,
			},
			{
				type: 'textinput',
				label: 'Prefix (for default path)',
				id: 'prefix',
				default: 'Screenshot ',
				useVariables: true,
				isVisible: (options) => options.customName === false,
			},
		],
		callback: async (action) => {
			let sourceName: any = action.options.source
			if (sourceName === 'programScene') {
				sourceName = self.states.programScene
			} else if (sourceName === 'previewScene') {
				sourceName = self.states.previewScene
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
				sourceName: sourceName,
				imageFormat: action.options.format as string,
				imageFilePath: filePath,
				imageCompressionQuality: quality as number,
			})
		},
	}

	actions['set_scene_item_properties'] = {
		name: 'Set Scene Item Properties',
		options: [
			{
				type: 'dropdown',
				label: 'Scene (optional)',
				id: 'scene',
				default: 'current',
				choices: [{ id: 'current', label: 'Current Program Scene' }, ...self.obsState.sceneChoices],
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
			let sourceScene = action.options.scene as string
			if (sourceScene === 'current') {
				sourceScene = self.states.programScene ?? ''
			}

			const transform: { [key: string]: number } = {}
			if (action.options.positionX) transform.positionX = Number(action.options.positionX)
			if (action.options.positionY) transform.positionY = Number(action.options.positionY)
			if (action.options.scaleX) transform.scaleX = Number(action.options.scaleX)
			if (action.options.scaleY) transform.scaleY = Number(action.options.scaleY)
			if (action.options.rotation) transform.rotation = Number(action.options.rotation)

			try {
				const sceneItem = await self.obs.sendRequest('GetSceneItemId', {
					sceneName: sourceScene,
					sourceName: action.options.source as string,
				})

				if (sceneItem?.sceneItemId) {
					await self.obs.sendRequest('SetSceneItemTransform', {
						sceneName: sourceScene,
						sceneItemId: sceneItem?.sceneItemId,
						sceneItemTransform: transform,
					})
				} else {
					self.log('warn', `Scene item not found for source: ${action.options.source} in scene: ${sourceScene}`)
					return
				}
			} catch (e: any) {
				self.log('error', `Set Scene Item Properties Error: ${e.message}`)
			}
		},
	}

	return actions
}
