import { CompanionActionDefinitions, createModuleLogger } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { opt } from '../utils.js'
import * as utils from '../utils.js'

const logger = createModuleLogger('Actions/Sources')

export function getSourceActions(self: OBSInstance): CompanionActionDefinitions {
	const actions: CompanionActionDefinitions = {}

	//Text Sources
	actions['setText'] = {
		name: 'Set Source Text',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.textSourceList?.[0] ? self.obsState.textSourceList[0].id : 'None',
				choices: self.obsState.textSourceList,
			},
			{
				type: 'textinput',
				label: 'Text',
				id: 'text',
				useVariables: true,
			},
		],
		callback: async (action) => {
			const sourceUuid = opt<string>(action, 'source')
			let newText = opt<string>(action, 'text')
			if (typeof newText === 'string') {
				newText = newText.replace(/\\n/g, '\n')
			}
			await self.obs.sendRequest('SetInputSettings', { inputUuid: sourceUuid, inputSettings: { text: newText } })
		},
		learn: (action) => {
			const sourceUuid = opt<string>(action, 'source')
			const source = self.states.sources.get(sourceUuid)
			const text = source?.settings?.text
			if (!text) return undefined
			return {
				text: text,
			}
		},
	}
	actions['setTextProperties'] = {
		name: 'Set Text Properties',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.textSourceList?.[0]?.id ?? 'None',
				choices: self.obsState.textSourceList,
			},
			{
				type: 'multidropdown',
				label: 'Properties',
				id: 'props',
				default: [],
				choices: [
					{ id: 'fontSize', label: 'Font Size' },
					{ id: 'fontFace', label: 'Font Face' },
					{ id: 'fontStyle', label: 'Font Style' },
					{ id: 'text', label: 'Text' },
					{ id: 'textTransform', label: 'Text Transform' },
					{ id: 'color1', label: 'Color 1' },
					{ id: 'color2', label: 'Color 2 / Gradient Color' },
					{ id: 'gradient', label: 'Gradient' },
					{ id: 'backgroundColor', label: 'Background Color' },
					{ id: 'backgroundOpacity', label: 'Background Opacity' },
					{ id: 'outline', label: 'Outline' },
					{ id: 'outlineSize', label: 'Outline Size' },
					{ id: 'outlineColor', label: 'Outline Color' },
					{ id: 'dropShadow', label: 'Drop Shadow' },
					{ id: 'alignment', label: 'Alignment' },
					{ id: 'verticalAlignment', label: 'Vertical Alignment' },
					{ id: 'extents', label: 'Use Custom Text Extents' },
					{ id: 'extentsWidth', label: 'Text Extents Width' },
					{ id: 'extentsHeight', label: 'Text Extents Height' },
					{ id: 'wrap', label: 'Wrap' },
					{ id: 'vertical', label: 'Vertical' },
				],
			},
			{
				type: 'textinput',
				label: 'Text',
				id: 'text',
				useVariables: true,
				isVisibleExpression: `arrayIncludes($(options:props), 'text')`,
			},
			{
				type: 'dropdown',
				label: 'Text Transform',
				id: 'textTransform',
				default: 0,
				choices: [
					{ id: 0, label: 'None' },
					{ id: 1, label: 'Uppercase' },
					{ id: 2, label: 'Lowercase' },
					{ id: 3, label: 'Start Case' },
				],
				isVisibleExpression: `arrayIncludes($(options:props), 'textTransform')`,
				description: 'GDI+ Text Sources Only',
			},
			{
				type: 'textinput',
				label: 'Font Size',
				id: 'fontSize',
				useVariables: true,
				isVisibleExpression: `arrayIncludes($(options:props), 'fontSize')`,
			},
			{
				type: 'textinput',
				label: 'Font Face',
				id: 'fontFace',
				useVariables: true,
				isVisibleExpression: `arrayIncludes($(options:props), 'fontFace')`,
			},
			{
				type: 'textinput',
				label: 'Font Style',
				id: 'fontStyle',
				useVariables: true,
				isVisibleExpression: `arrayIncludes($(options:props), 'fontStyle')`,
			},
			{
				type: 'colorpicker',
				label: 'Color 1',
				id: 'color1',
				default: '#000000',
				enableAlpha: true,
				returnType: 'string',
				isVisibleExpression: `arrayIncludes($(options:props), 'color1')`,
			},
			{
				type: 'colorpicker',
				label: 'Color 2 / Gradient Color',
				id: 'color2',
				default: '#000000',
				enableAlpha: true,
				returnType: 'string',
				isVisibleExpression: `arrayIncludes($(options:props), 'color2')`,
			},
			{
				type: 'checkbox',
				label: 'Gradient',
				id: 'gradient',
				default: false,
				isVisibleExpression: `arrayIncludes($(options:props), 'gradient')`,
			},
			{
				type: 'checkbox',
				label: 'Outline',
				id: 'outline',
				default: false,
				isVisibleExpression: `arrayIncludes($(options:props), 'outline')`,
			},
			{
				type: 'textinput',
				label: 'Outline Size',
				id: 'outlineSize',
				default: '1',
				isVisibleExpression: `arrayIncludes($(options:props), 'outlineSize')`,
				description: 'GDI+ Text Sources Only',
				useVariables: true,
			},
			{
				type: 'colorpicker',
				label: 'Outline Color',
				id: 'outlineColor',
				default: '#000000',
				enableAlpha: true,
				returnType: 'string',
				isVisibleExpression: `arrayIncludes($(options:props), 'outlineColor')`,
				description: 'GDI+ Text Sources Only',
			},
			{
				type: 'colorpicker',
				label: 'Background Color',
				id: 'backgroundColor',
				default: '#000000',
				enableAlpha: true,
				returnType: 'string',
				isVisibleExpression: `arrayIncludes($(options:props), 'backgroundColor')`,
				description: 'GDI+ Text Sources Only',
			},
			{
				type: 'textinput',
				label: 'Background Opacity',
				id: 'backgroundOpacity',
				default: '100',
				isVisibleExpression: `arrayIncludes($(options:props), 'backgroundOpacity')`,
				description: 'GDI+ Text Sources Only',
				useVariables: true,
			},
			{
				type: 'checkbox',
				label: 'Drop Shadow',
				id: 'dropShadow',
				default: false,
				isVisibleExpression: `arrayIncludes($(options:props), 'dropShadow')`,
				description: 'FreeType Text Sources Only',
			},
			{
				type: 'checkbox',
				label: 'Wrap',
				id: 'wrap',
				default: false,
				isVisibleExpression: `arrayIncludes($(options:props), 'wrap')`,
			},
			{
				type: 'dropdown',
				label: 'Alignment',
				id: 'alignment',
				default: 'left',
				choices: [
					{ id: 'left', label: 'Left' },
					{ id: 'center', label: 'Center' },
					{ id: 'right', label: 'Right' },
				],
				description: 'GDI+ Text Sources Only',
				isVisibleExpression: `arrayIncludes($(options:props), 'alignment')`,
			},
			{
				type: 'dropdown',
				label: 'Vertical Alignment',
				id: 'verticalAlignment',
				default: 'top',
				choices: [
					{ id: 'top', label: 'Top' },
					{ id: 'center', label: 'Center' },
					{ id: 'bottom', label: 'Bottom' },
				],
				description: 'GDI+ Text Sources Only',
				isVisibleExpression: `arrayIncludes($(options:props), 'verticalAlignment')`,
			},
			{
				type: 'checkbox',
				label: 'Vertical',
				id: 'vertical',
				default: false,
				isVisibleExpression: `arrayIncludes($(options:props), 'vertical')`,
				description: 'GDI+ Text Sources Only',
			},
			{
				type: 'checkbox',
				label: 'Use Custom Text Extents',
				id: 'extents',
				default: false,
				isVisibleExpression: `arrayIncludes($(options:props), 'extents')`,
				description: 'GDI+ Text Sources Only',
			},
			{
				type: 'textinput',
				label: 'Text Extents Width',
				id: 'extentsWidth',
				default: '100',
				isVisibleExpression: `arrayIncludes($(options:props), 'extentsWidth')`,
				useVariables: true,
				description: 'GDI+ Text Sources Only',
			},
			{
				type: 'textinput',
				label: 'Text Extents Height',
				id: 'extentsHeight',
				default: '100',
				isVisibleExpression: `arrayIncludes($(options:props), 'extentsHeight')`,
				useVariables: true,
				description: 'GDI+ Text Sources Only',
			},
		],
		callback: async (action) => {
			const sourceUuid = opt<string>(action, 'source')
			const props = opt<string[]>(action, 'props') || []
			const source = self.states.sources.get(sourceUuid)
			const existingSettings = { ...(source?.settings || {}) }

			// Start with all existing settings, then overlay changes
			const inputSettings: Record<string, any> = { ...existingSettings }
			// Always copy font if it exists, as object, even if not changing
			const existingFont = existingSettings.font ? { ...existingSettings.font } : {}
			const kind = source?.inputKind || ''

			for (const prop of props) {
				if (prop === 'text') {
					let val = opt<string>(action, 'text')
					// Unescape \n for newlines
					if (typeof val === 'string') {
						val = val.replace(/\\n/g, '\n')
					}
					inputSettings.text = val
				}
				if (prop === 'textTransform' && kind.includes('text_gdiplus')) {
					inputSettings.transform = opt<any>(action, 'textTransform')
				}
				if (prop === 'fontSize') {
					const size = opt<string>(action, 'fontSize')
					const sizeNumber = parseInt(size)
					if (!isNaN(sizeNumber)) {
						existingFont.size = sizeNumber
					}
				}
				if (prop === 'fontFace') {
					const face = opt<string>(action, 'fontFace')
					if (face) {
						existingFont.face = face
					}
				}
				if (prop === 'fontStyle') {
					const style = opt<string>(action, 'fontStyle')
					if (style) {
						existingFont.style = style
					}
				}
				if (prop === 'color1') {
					const colorValue = utils.rgbaToObsColor(opt<string>(action, 'color1'))
					if (kind.includes('text_gdiplus')) {
						inputSettings.color = colorValue
					} else {
						inputSettings.color1 = colorValue
					}
				}
				if (prop === 'color2') {
					const colorValue = utils.rgbaToObsColor(opt<string>(action, 'color2'))
					if (kind.includes('text_gdiplus')) {
						inputSettings.gradient_color = colorValue
					} else {
						inputSettings.color2 = colorValue
					}
				}
				if (prop === 'outline') {
					inputSettings.outline = opt<any>(action, 'outline')
				}
				if (prop === 'outlineSize' && kind.includes('text_gdiplus')) {
					const outlineSize = opt<string>(action, 'outlineSize')
					const size = parseInt(outlineSize)
					if (!isNaN(size)) {
						inputSettings.outline_size = size
					}
				}
				if (prop === 'outlineColor' && kind.includes('text_gdiplus')) {
					const colorValue = utils.rgbaToObsColor(opt<string>(action, 'outlineColor'))
					inputSettings.outline_color = colorValue
				}
				if (prop === 'backgroundColor' && kind.includes('text_gdiplus')) {
					const colorValue = utils.rgbaToObsColor(opt<string>(action, 'backgroundColor'))
					inputSettings.bk_color = colorValue
				}
				if (prop === 'backgroundOpacity' && kind.includes('text_gdiplus')) {
					const backgroundOpacity = opt<string>(action, 'backgroundOpacity')
					const opacity = parseInt(backgroundOpacity)
					if (!isNaN(opacity)) {
						inputSettings.bk_opacity = opacity
					}
				}
				if (prop === 'gradient') {
					inputSettings.gradient = opt<any>(action, 'gradient')
				}

				if (prop === 'dropShadow') {
					inputSettings.drop_shadow = opt<any>(action, 'dropShadow')
				}
				if (prop === 'wrap') {
					if (kind.includes('text_gdiplus')) {
						inputSettings.extents_wrap = opt<any>(action, 'wrap')
					} else {
						inputSettings.word_wrap = opt<any>(action, 'wrap')
					}
				}
				if (prop === 'alignment' && kind.includes('text_gdiplus')) {
					inputSettings.align = opt<any>(action, 'alignment')
				}
				if (prop === 'verticalAlignment' && kind.includes('text_gdiplus')) {
					inputSettings.valign = opt<any>(action, 'verticalAlignment')
				}
				if (prop === 'extents' && kind.includes('text_gdiplus')) {
					inputSettings.extents = opt<any>(action, 'extents')
				}
				if (prop === 'extentsWidth' && kind.includes('text_gdiplus')) {
					const extentsWidth = opt<string>(action, 'extentsWidth')
					const width = parseInt(extentsWidth)
					if (!isNaN(width)) {
						inputSettings.extents_cx = width
					}
				}
				if (prop === 'extentsHeight' && kind.includes('text_gdiplus')) {
					const extentsHeight = opt<string>(action, 'extentsHeight')
					const height = parseInt(extentsHeight)
					if (!isNaN(height)) {
						inputSettings.extents_cy = height
					}
				}
				if (prop === 'vertical' && kind.includes('text_gdiplus')) {
					inputSettings.vertical = opt<any>(action, 'vertical')
				}
			}

			// If editing any font property, always send font object including existing settings
			if (
				props.some((prop) => ['fontSize', 'fontFace', 'fontStyle'].includes(prop)) &&
				Object.keys(existingFont).length > 0
			) {
				inputSettings.font = existingFont
			}
			await self.obs.sendRequest('SetInputSettings', {
				inputUuid: sourceUuid,
				inputSettings: inputSettings,
			})
		},
		learn: (action) => {
			const sourceUuid = opt<string>(action, 'source')
			const source = self.states.sources.get(sourceUuid)
			const settings = source?.settings
			if (!settings) return undefined

			const props = opt<string[]>(action, 'props') || []
			const newOptions: Record<string, any> = { ...action.options }
			const kind = source.inputKind || ''

			const setIfProp = (prop: string, value: any): void => {
				if (props.includes(prop) && value !== undefined) {
					newOptions[prop] = value
				}
			}

			setIfProp('text', settings.text)

			const font = settings.font
			if (font) {
				setIfProp('fontSize', font.size)
				setIfProp('fontFace', font.face)
				setIfProp('fontStyle', font.style)
			}

			if (kind.includes('text_gdiplus')) {
				setIfProp('textTransform', settings.transform)
				if (settings.color !== undefined) setIfProp('color1', utils.obsColorToRgba(settings.color))
				if (settings.gradient_color !== undefined) setIfProp('color2', utils.obsColorToRgba(settings.gradient_color))
				setIfProp('gradient', settings.gradient)
				setIfProp('outline', settings.outline)
				setIfProp('outlineSize', settings.outline_size)
				if (settings.outline_color !== undefined)
					setIfProp('outlineColor', utils.obsColorToRgba(settings.outline_color))
				if (settings.bk_color !== undefined) setIfProp('backgroundColor', utils.obsColorToRgba(settings.bk_color))
				setIfProp('backgroundOpacity', settings.bk_opacity)
				setIfProp('wrap', settings.extents_wrap)
				setIfProp('alignment', settings.align)
				setIfProp('verticalAlignment', settings.valign)
				setIfProp('extents', settings.extents)
				setIfProp('extentsWidth', settings.extents_cx)
				setIfProp('extentsHeight', settings.extents_cy)
				setIfProp('vertical', settings.vertical)
			} else {
				if (settings.color1 !== undefined) setIfProp('color1', utils.obsColorToRgba(settings.color1))
				if (settings.color2 !== undefined) setIfProp('color2', utils.obsColorToRgba(settings.color2))
				setIfProp('outline', settings.outline)
				setIfProp('dropShadow', settings.drop_shadow)
				setIfProp('wrap', settings.word_wrap)
			}

			return newOptions
		},
	}
	actions['resetCaptureDevice'] = {
		name: 'Reset Video Capture Device',
		description: 'Deactivates and Reactivates a Video Capture Source to reset it',
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
			const sourceUuid = opt<string>(action, 'source')
			const source = self.states.sources.get(sourceUuid)
			if (source?.inputKind) {
				await self.obs.sendRequest('SetInputSettings', { inputUuid: sourceUuid, inputSettings: {} })
			} else {
				logger.warn('The selected source is not an input.')
				return
			}
		},
	}

	//Filters
	actions['toggle_filter'] = {
		name: 'Filter - Set Visibility',
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
			const filterName = opt<string>(action, 'filter')

			await self.obs.setFilterVisibility(filterName, opt<string>(action, 'visible'), {
				allSources: opt<boolean>(action, 'allSources'),
				source: opt<string>(action, 'source'),
			})
		},
		learn: (action) => {
			if (opt<any>(action, 'allSources')) return undefined
			const sourceUuid = opt<string>(action, 'source')
			const filterName = opt<string>(action, 'filter')
			const filters = self.states.sourceFilters.get(sourceUuid)
			const filter = filters?.find((f) => f.filterName === filterName)
			if (!filter) return undefined
			return {
				visible: filter.filterEnabled ? 'true' : 'false',
			}
		},
	}

	actions['setFilterSettings'] = {
		name: 'Filter - Set Settings',
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
				const settings = opt<string>(action, 'settings')
				const settingsJSON = JSON.parse(settings)
				await self.obs.sendRequest('SetSourceFilterSettings', {
					sourceUuid: opt<string>(action, 'source'),
					filterName: opt<string>(action, 'filter'),
					filterSettings: settingsJSON,
				})
			} catch (e: any) {
				logger.error(`Set Filter Settings Error: ${e.message}`)
			}
		},
		learn: (action) => {
			const sourceUuid = opt<string>(action, 'source')
			const filterName = opt<string>(action, 'filter')
			const filters = self.states.sourceFilters.get(sourceUuid)
			const filter = filters?.find((f) => f.filterName === filterName)
			if (!filter) return undefined
			return {
				settings: JSON.stringify(filter.filterSettings, null, 2),
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
			const sourceUuid = opt<string>(action, 'source')
			if (self.states.sources.get(sourceUuid)?.inputKind === 'browser_source') {
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
			if (opt<any>(action, 'useProgramScene')) {
				sourceUuid = self.states.programSceneUuid
			} else if (opt<any>(action, 'usePreviewScene')) {
				sourceUuid = self.states.previewSceneUuid
			} else {
				sourceUuid = opt<string>(action, 'source')
			}

			let filePath
			if (opt<any>(action, 'customName')) {
				filePath = opt<string>(action, 'path')
			} else {
				const prefix = opt<string>(action, 'prefix')
				filePath = `${self.states.recordDirectory}/${prefix}${new Date().getTime()}.${opt<any>(action, 'format')}`
			}

			const quality = opt<any>(action, 'compression') === 0 ? -1 : opt<any>(action, 'compression')

			await self.obs.sendRequest('SaveSourceScreenshot', {
				sourceUuid: sourceUuid,
				imageFormat: opt<string>(action, 'format'),
				imageFilePath: filePath,
				imageCompressionQuality: quality as number,
			})
		},
	}

	actions['source_properties'] = {
		name: 'Source - Set Transform Properties',
		description: 'Sets the transform properties (position, scale, rotation) of a source',
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
			const sourceSceneUuid = opt<any>(action, 'useProgramScene')
				? self.states.programSceneUuid
				: opt<string>(action, 'scene')
			const sourceUuid = opt<string>(action, 'source')

			const transform: { [key: string]: number } = {}
			if (opt<any>(action, 'positionX')) transform.positionX = Number(opt<string>(action, 'positionX'))
			if (opt<any>(action, 'positionY')) transform.positionY = Number(opt<string>(action, 'positionY'))
			if (opt<any>(action, 'scaleX')) transform.scaleX = Number(opt<string>(action, 'scaleX'))
			if (opt<any>(action, 'scaleY')) transform.scaleY = Number(opt<string>(action, 'scaleY'))
			if (opt<any>(action, 'rotation')) transform.rotation = Number(opt<string>(action, 'rotation'))

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
					logger.warn(`Scene item not found for source: ${sourceUuid} in scene: ${sourceSceneUuid}`)
					return
				}
			} catch (e: any) {
				logger.error(`Set Scene Item Properties Error: ${e.message}`)
			}
		},
	}

	actions['toggle_scene_item'] = {
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
			const sourceUuid = opt<string>(action, 'source')
			await self.obs.setSourceVisibility(sourceUuid, opt<string>(action, 'visible'), {
				anyScene: opt<boolean>(action, 'anyScene'),
				useCurrentScene: opt<boolean>(action, 'useCurrentScene'),
				scene: opt<string>(action, 'scene'),
			})
		},
		learn: (action) => {
			if (opt<any>(action, 'anyScene')) return undefined
			const sourceUuid = opt<string>(action, 'source')
			const sceneUuid = opt<any>(action, 'useCurrentScene')
				? self.states.programSceneUuid
				: opt<string>(action, 'scene')
			const sceneItems = self.states.sceneItems.get(sceneUuid)
			const item = sceneItems?.find((i) => i.sourceUuid === sourceUuid)
			if (!item) return undefined
			return {
				visible: item.sceneItemEnabled ? 'true' : 'false',
			}
		},
	}

	return actions
}
