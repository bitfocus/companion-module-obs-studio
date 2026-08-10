import { CompanionActionDefinitions, createModuleLogger } from '@companion-module/base'
import type OBSInstance from '../main.js'
import * as utils from '../utils.js'

const logger = createModuleLogger('Actions/Sources')

export type SourceActionSchemas = {
	setText: { options: { source: string; text: string } }
	setTextProperties: {
		options: {
			source: string
			props: string[]
			text: string
			textTransform: number
			fontSize: string
			fontFace: string
			fontStyle: string
			// Colour pickers hand back CSS colour strings, which rgbaToObsColor parses.
			color1: string
			color2: string
			gradient: boolean
			outline: boolean
			outlineSize: string
			outlineColor: string
			backgroundColor: string
			backgroundOpacity: string
			dropShadow: boolean
			wrap: boolean
			alignment: 'left' | 'center' | 'right'
			verticalAlignment: 'top' | 'center' | 'bottom'
			vertical: boolean
			extents: boolean
			extentsWidth: string
			extentsHeight: string
		}
	}
	resetCaptureDevice: { options: { source: string } }
	toggle_filter: {
		options: { allSources: boolean; source: string; filter: string; visible: 'true' | 'false' | 'toggle' }
	}
	setFilterSettings: { options: { source: string; filter: string; settings: string } }
	refresh_browser_source: { options: { source: string } }
	take_screenshot: {
		options: {
			useProgramScene: boolean
			usePreviewScene: boolean
			source: string
			format: string
			compression: number
			customName: boolean
			path: string
			prefix: string
		}
		result: string | null
	}
	source_properties: {
		options: {
			useProgramScene: boolean
			scene: string
			source: string
			positionX: string
			positionY: string
			scaleX: string
			scaleY: string
			rotation: string
		}
	}
	toggle_scene_item: {
		options: {
			anyScene: boolean
			useCurrentScene: boolean
			scene: string
			source: string
			visible: 'true' | 'false' | 'toggle'
		}
	}
}

export function getSourceActions(self: OBSInstance): CompanionActionDefinitions<SourceActionSchemas> {
	return {
		// Text Sources
		setText: {
			name: 'Set Source Text',
			options: [
				{
					type: 'dropdown',
					allowCustom: true,
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
				const sourceName = action.options.source
				let newText = action.options.text
				if (typeof newText === 'string') {
					newText = newText.replace(/\\n/g, '\n')
				}
				await self.obs.sendRequest('SetInputSettings', { inputName: sourceName, inputSettings: { text: newText } })
			},
			learn: (action) => {
				const sourceName = action.options.source
				const source = self.obsState.findSourceByName(sourceName)
				const text = source?.settings?.text
				if (!text) return undefined
				return {
					text: text,
				}
			},
		},
		setTextProperties: {
			name: 'Set Text Properties',
			options: [
				{
					type: 'dropdown',
					allowCustom: true,
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
					disableAutoExpression: true,
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
					disableAutoExpression: true,
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
					disableAutoExpression: true,
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
				const sourceName = action.options.source
				const props = action.options.props || []
				const source = self.obsState.findSourceByName(sourceName)
				const existingSettings = { ...(source?.settings || {}) }

				// Start with existing settings, then overlay changes.
				const inputSettings: Record<string, any> = { ...existingSettings }
				// Always copy font object if it exists.
				const existingFont = existingSettings.font ? { ...existingSettings.font } : {}
				const kind = source?.inputKind || ''

				for (const prop of props) {
					if (prop === 'text') {
						let val = action.options.text
						// Unescape \n for newlines.
						if (typeof val === 'string') {
							val = val.replace(/\\n/g, '\n')
						}
						inputSettings.text = val
					}
					if (prop === 'textTransform' && kind.includes('text_gdiplus')) {
						inputSettings.transform = action.options.textTransform
					}
					if (prop === 'fontSize') {
						const size = action.options.fontSize
						const sizeNumber = parseInt(size)
						if (!isNaN(sizeNumber)) {
							existingFont.size = sizeNumber
						}
					}
					if (prop === 'fontFace') {
						const face = action.options.fontFace
						if (face) {
							existingFont.face = face
						}
					}
					if (prop === 'fontStyle') {
						const style = action.options.fontStyle
						if (style) {
							existingFont.style = style
						}
					}
					if (prop === 'color1') {
						const colorValue = utils.rgbaToObsColor(action.options.color1)
						if (kind.includes('text_gdiplus')) {
							inputSettings.color = colorValue
						} else {
							inputSettings.color1 = colorValue
						}
					}
					if (prop === 'color2') {
						const colorValue = utils.rgbaToObsColor(action.options.color2)
						if (kind.includes('text_gdiplus')) {
							inputSettings.gradient_color = colorValue
						} else {
							inputSettings.color2 = colorValue
						}
					}
					if (prop === 'outline') {
						inputSettings.outline = action.options.outline
					}
					if (prop === 'outlineSize' && kind.includes('text_gdiplus')) {
						const outlineSize = action.options.outlineSize
						const size = parseInt(outlineSize)
						if (!isNaN(size)) {
							inputSettings.outline_size = size
						}
					}
					if (prop === 'outlineColor' && kind.includes('text_gdiplus')) {
						const colorValue = utils.rgbaToObsColor(action.options.outlineColor)
						inputSettings.outline_color = colorValue
					}
					if (prop === 'backgroundColor' && kind.includes('text_gdiplus')) {
						const colorValue = utils.rgbaToObsColor(action.options.backgroundColor)
						inputSettings.bk_color = colorValue
					}
					if (prop === 'backgroundOpacity' && kind.includes('text_gdiplus')) {
						const backgroundOpacity = action.options.backgroundOpacity
						const opacity = parseInt(backgroundOpacity)
						if (!isNaN(opacity)) {
							inputSettings.bk_opacity = opacity
						}
					}
					if (prop === 'gradient') {
						inputSettings.gradient = action.options.gradient
					}

					if (prop === 'dropShadow') {
						inputSettings.drop_shadow = action.options.dropShadow
					}
					if (prop === 'wrap') {
						if (kind.includes('text_gdiplus')) {
							inputSettings.extents_wrap = action.options.wrap
						} else {
							inputSettings.word_wrap = action.options.wrap
						}
					}
					if (prop === 'alignment' && kind.includes('text_gdiplus')) {
						inputSettings.align = action.options.alignment
					}
					if (prop === 'verticalAlignment' && kind.includes('text_gdiplus')) {
						inputSettings.valign = action.options.verticalAlignment
					}
					if (prop === 'extents' && kind.includes('text_gdiplus')) {
						inputSettings.extents = action.options.extents
					}
					if (prop === 'extentsWidth' && kind.includes('text_gdiplus')) {
						const extentsWidth = action.options.extentsWidth
						const width = parseInt(extentsWidth)
						if (!isNaN(width)) {
							inputSettings.extents_cx = width
						}
					}
					if (prop === 'extentsHeight' && kind.includes('text_gdiplus')) {
						const extentsHeight = action.options.extentsHeight
						const height = parseInt(extentsHeight)
						if (!isNaN(height)) {
							inputSettings.extents_cy = height
						}
					}
					if (prop === 'vertical' && kind.includes('text_gdiplus')) {
						inputSettings.vertical = action.options.vertical
					}
				}

				// Send font object including existing settings when editing font properties.
				if (
					props.some((prop) => ['fontSize', 'fontFace', 'fontStyle'].includes(prop)) &&
					Object.keys(existingFont).length > 0
				) {
					inputSettings.font = existingFont
				}
				await self.obs.sendRequest('SetInputSettings', {
					inputName: sourceName,
					inputSettings: inputSettings,
				})
			},
			learn: (action) => {
				const sourceName = action.options.source
				const source = self.obsState.findSourceByName(sourceName)
				const settings = source?.settings
				if (!settings) return undefined

				const props = action.options.props || []
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
		},
		resetCaptureDevice: {
			name: 'Reset Video Capture Device',
			description: 'Deactivates and Reactivates a Video Capture Source to reset it',
			options: [
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Source',
					id: 'source',
					default: self.obsState.sourceListDefault,
					choices: self.obsState.sourceChoices,
				},
			],
			callback: async (action) => {
				const sourceName = action.options.source
				const source = self.obsState.findSourceByName(sourceName)
				if (source?.inputKind) {
					await self.obs.sendRequest('SetInputSettings', { inputName: sourceName, inputSettings: {} })
				} else {
					logger.warn('The selected source is not an input.')
					return
				}
			},
		},

		// Filters
		toggle_filter: {
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
					allowCustom: true,
					label: 'Source',
					id: 'source',
					default: self.obsState.sourceListDefault,
					choices: self.obsState.sourceChoicesWithScenes,
					isVisibleExpression: `!$(options:allSources)`,
				},
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Filter',
					id: 'filter',
					default: self.obsState.filterListDefault,
					choices: self.obsState.filterList,
				},
				{
					type: 'dropdown',
					disableAutoExpression: true,
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
				const filterName = action.options.filter

				await self.obs.setFilterVisibility(filterName, action.options.visible, {
					allSources: action.options.allSources,
					source: action.options.source,
				})
			},
			learn: (action) => {
				if (action.options.allSources) return undefined
				const sourceName = action.options.source
				const filterName = action.options.filter
				const filters = self.obsState.findSourceFiltersByName(sourceName)
				const filter = filters?.find((f) => f.filterName === filterName)
				if (!filter) return undefined
				return {
					visible: filter.filterEnabled ? 'true' : 'false',
				}
			},
		},

		setFilterSettings: {
			name: 'Filter - Set Settings',
			description: 'Sets the settings for a filter using a JSON object',
			options: [
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Source',
					id: 'source',
					default: self.obsState.sourceListDefault,
					choices: self.obsState.sourceChoicesWithScenes,
				},
				{
					type: 'dropdown',
					allowCustom: true,
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
					const settings = action.options.settings
					const settingsJSON = JSON.parse(settings)
					await self.obs.sendRequest('SetSourceFilterSettings', {
						sourceName: action.options.source,
						filterName: action.options.filter,
						filterSettings: settingsJSON,
					})
				} catch (e: any) {
					logger.error(`Set Filter Settings Error: ${e.message}`)
				}
			},
			learn: (action) => {
				const sourceName = action.options.source
				const filterName = action.options.filter
				const filters = self.obsState.findSourceFiltersByName(sourceName)
				const filter = filters?.find((f) => f.filterName === filterName)
				if (!filter) return undefined
				return {
					settings: JSON.stringify(filter.filterSettings, null, 2),
				}
			},
		},

		refresh_browser_source: {
			name: 'Refresh Browser Source',
			description: 'Refreshes the cache of a specific browser source',
			options: [
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Source',
					id: 'source',
					default: self.obsState.sourceListDefault,
					choices: self.obsState.sourceChoices,
				},
			],
			callback: async (action) => {
				const sourceName = action.options.source
				if (self.obsState.findSourceByName(sourceName)?.inputKind === 'browser_source') {
					await self.obs.sendRequest('PressInputPropertiesButton', {
						inputName: sourceName,
						propertyName: 'refreshnocache',
					})
				}
			},
		},

		take_screenshot: {
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
					allowCustom: true,
					label: 'Source',
					id: 'source',
					default: self.obsState.sourceListDefault,
					choices: self.obsState.sourceChoices,
					isVisibleExpression: `!$(options:useProgramScene) && !$(options:usePreviewScene)`,
				},
				{
					type: 'dropdown',
					disableAutoExpression: true,
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
					clampValues: true,
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
			hasResult: true,
			callback: async (action) => {
				let sourceName: string
				if (action.options.useProgramScene) {
					sourceName = self.states.programScene
				} else if (action.options.usePreviewScene) {
					sourceName = self.states.previewScene
				} else {
					sourceName = action.options.source
				}

				let filePath
				if (action.options.customName) {
					filePath = action.options.path
				} else {
					const prefix = action.options.prefix
					filePath = `${self.states.recordDirectory}/${prefix}${new Date().getTime()}.${action.options.format}`
				}

				const quality = action.options.compression === 0 ? -1 : action.options.compression

				const res = await self.obs.sendRequest('SaveSourceScreenshot', {
					sourceName: sourceName,
					imageFormat: action.options.format,
					imageFilePath: filePath,
					imageCompressionQuality: quality,
				})
				// SaveSourceScreenshot returns no data; surface the path for reference.
				return res !== undefined ? (filePath ?? null) : null
			},
		},

		source_properties: {
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
					allowCustom: true,
					label: 'Scene',
					id: 'scene',
					default: self.obsState.sceneListDefault,
					choices: self.obsState.sceneChoices,
					isVisibleExpression: `!$(options:useProgramScene)`,
				},
				{
					type: 'dropdown',
					allowCustom: true,
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
				const sourceSceneName = action.options.useProgramScene ? self.states.programScene : action.options.scene
				const sourceName = action.options.source

				const transform: { [key: string]: number } = {}
				if (action.options.positionX) transform.positionX = Number(action.options.positionX)
				if (action.options.positionY) transform.positionY = Number(action.options.positionY)
				if (action.options.scaleX) transform.scaleX = Number(action.options.scaleX)
				if (action.options.scaleY) transform.scaleY = Number(action.options.scaleY)
				if (action.options.rotation) transform.rotation = Number(action.options.rotation)

				try {
					const sceneItem = await self.obs.sendRequest('GetSceneItemId', {
						sceneName: sourceSceneName,
						sourceName: sourceName,
					})

					if (sceneItem?.sceneItemId) {
						await self.obs.sendRequest('SetSceneItemTransform', {
							sceneName: sourceSceneName,
							sceneItemId: sceneItem?.sceneItemId,
							sceneItemTransform: transform,
						})
					} else {
						logger.warn(`Scene item not found for source: ${sourceName} in scene: ${sourceSceneName}`)
						return
					}
				} catch (e: any) {
					logger.error(`Set Scene Item Properties Error: ${e.message}`)
				}
			},
		},

		toggle_scene_item: {
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
					allowCustom: true,
					label: 'Scene',
					id: 'scene',
					default: self.obsState.sceneListDefault,
					choices: self.obsState.sceneChoices,
					isVisibleExpression: '!$(options:anyScene) &&!$(options:useCurrentScene)',
				},
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Source',
					id: 'source',
					default: self.obsState.sourceListDefault,
					choices: self.obsState.sourceChoices,
				},
				{
					type: 'dropdown',
					disableAutoExpression: true,
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
				const sourceUuid = action.options.source
				await self.obs.setSourceVisibility(sourceUuid, action.options.visible, {
					anyScene: action.options.anyScene,
					useCurrentScene: action.options.useCurrentScene,
					scene: action.options.scene,
				})
			},
			learn: (action) => {
				if (action.options.anyScene) return undefined
				const sourceName = action.options.source
				const source = self.obsState.findSourceByName(sourceName)
				if (!source) return undefined
				const sceneName = action.options.useCurrentScene ? self.states.programScene : action.options.scene
				const sceneItems = self.obsState.findSceneItemsByName(sceneName)
				const item = sceneItems?.find((i) => i.sourceUuid === source.sourceUuid)
				if (!item) return undefined
				return {
					visible: item.sceneItemEnabled ? 'true' : 'false',
				}
			},
		},
	}
}
