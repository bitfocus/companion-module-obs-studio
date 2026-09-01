import { CompanionActionDefinitions, createModuleLogger, type JsonObject } from '@companion-module/base'
import type OBSInstance from '../main.js'
import * as utils from '../utils.js'
import type { OBSTextSourceFont } from '../types.js'
import { INPUT_KIND_PREFIX_TEXT_GDIPLUS } from '../constants.js'
import { choiceDropdown, choiceMultiDropdown } from './options.js'

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
			props: string[]
			positionX: string
			positionY: string
			scaleX: string
			scaleY: string
			rotation: string
		}
	}
	toggle_scene_item: {
		options: {
			allSources: boolean
			target: 'allScenes' | 'currentScene' | 'scene' | 'group'
			scene: string
			group: string
			source: string[]
			except: string[]
			includeGroupChildren: boolean
			visible: 'true' | 'false' | 'toggle'
		}
	}
}

export function getSourceActions(self: OBSInstance): CompanionActionDefinitions<SourceActionSchemas> {
	return {
		// Text Sources
		setText: {
			name: 'Source - Set Source Text',
			options: [
				choiceDropdown(self, 'textSource', { id: 'source', label: 'Source' }),
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
				const text = utils.asString(source?.settings?.text)
				if (!text) return undefined
				return { text }
			},
		},
		setTextProperties: {
			name: 'Source - Set Text Properties',
			options: [
				choiceDropdown(self, 'textSource', { id: 'source', label: 'Source' }),
				{
					type: 'multidropdown',
					disableAutoExpression: true,
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
				const inputSettings: JsonObject = { ...existingSettings }
				// Always copy font object if it exists.
				const existingFont: OBSTextSourceFont = { ...(existingSettings.font as OBSTextSourceFont | undefined) }
				const kind = source?.inputKind ?? ''

				for (const prop of props) {
					if (prop === 'text') {
						let val = action.options.text
						// Unescape \n for newlines.
						if (typeof val === 'string') {
							val = val.replace(/\\n/g, '\n')
						}
						inputSettings.text = val
					}
					if (prop === 'textTransform' && kind.includes(INPUT_KIND_PREFIX_TEXT_GDIPLUS)) {
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
						if (kind.includes(INPUT_KIND_PREFIX_TEXT_GDIPLUS)) {
							inputSettings.color = colorValue
						} else {
							inputSettings.color1 = colorValue
						}
					}
					if (prop === 'color2') {
						const colorValue = utils.rgbaToObsColor(action.options.color2)
						if (kind.includes(INPUT_KIND_PREFIX_TEXT_GDIPLUS)) {
							inputSettings.gradient_color = colorValue
						} else {
							inputSettings.color2 = colorValue
						}
					}
					if (prop === 'outline') {
						inputSettings.outline = action.options.outline
					}
					if (prop === 'outlineSize' && kind.includes(INPUT_KIND_PREFIX_TEXT_GDIPLUS)) {
						const outlineSize = action.options.outlineSize
						const size = parseInt(outlineSize)
						if (!isNaN(size)) {
							inputSettings.outline_size = size
						}
					}
					if (prop === 'outlineColor' && kind.includes(INPUT_KIND_PREFIX_TEXT_GDIPLUS)) {
						const colorValue = utils.rgbaToObsColor(action.options.outlineColor)
						inputSettings.outline_color = colorValue
					}
					if (prop === 'backgroundColor' && kind.includes(INPUT_KIND_PREFIX_TEXT_GDIPLUS)) {
						const colorValue = utils.rgbaToObsColor(action.options.backgroundColor)
						inputSettings.bk_color = colorValue
					}
					if (prop === 'backgroundOpacity' && kind.includes(INPUT_KIND_PREFIX_TEXT_GDIPLUS)) {
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
						if (kind.includes(INPUT_KIND_PREFIX_TEXT_GDIPLUS)) {
							inputSettings.extents_wrap = action.options.wrap
						} else {
							inputSettings.word_wrap = action.options.wrap
						}
					}
					if (prop === 'alignment' && kind.includes(INPUT_KIND_PREFIX_TEXT_GDIPLUS)) {
						inputSettings.align = action.options.alignment
					}
					if (prop === 'verticalAlignment' && kind.includes(INPUT_KIND_PREFIX_TEXT_GDIPLUS)) {
						inputSettings.valign = action.options.verticalAlignment
					}
					if (prop === 'extents' && kind.includes(INPUT_KIND_PREFIX_TEXT_GDIPLUS)) {
						inputSettings.extents = action.options.extents
					}
					if (prop === 'extentsWidth' && kind.includes(INPUT_KIND_PREFIX_TEXT_GDIPLUS)) {
						const extentsWidth = action.options.extentsWidth
						const width = parseInt(extentsWidth)
						if (!isNaN(width)) {
							inputSettings.extents_cx = width
						}
					}
					if (prop === 'extentsHeight' && kind.includes(INPUT_KIND_PREFIX_TEXT_GDIPLUS)) {
						const extentsHeight = action.options.extentsHeight
						const height = parseInt(extentsHeight)
						if (!isNaN(height)) {
							inputSettings.extents_cy = height
						}
					}
					if (prop === 'vertical' && kind.includes(INPUT_KIND_PREFIX_TEXT_GDIPLUS)) {
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

				const learnedOptions: Record<string, unknown> = { ...action.options }
				const kind = source.inputKind ?? ''

				/** Learn every field OBS reported a value for, regardless of which props are currently selected. */
				const setIfProp = (prop: string, value: unknown): void => {
					if (value !== undefined) {
						learnedOptions[prop] = value
					}
				}

				/** OBS stores colours as packed 32-bit integers; the UI expects an rgba() string. */
				const setColorIfProp = (prop: string, packedColor: unknown): void => {
					const color = utils.asNumber(packedColor)
					if (color !== undefined) setIfProp(prop, utils.obsColorToRgba(color))
				}

				setIfProp('text', settings.text)

				const font = settings.font as OBSTextSourceFont | undefined
				if (font) {
					setIfProp('fontSize', font.size)
					setIfProp('fontFace', font.face)
					setIfProp('fontStyle', font.style)
				}

				if (kind.includes(INPUT_KIND_PREFIX_TEXT_GDIPLUS)) {
					setIfProp('textTransform', settings.transform)
					setColorIfProp('color1', settings.color)
					setColorIfProp('color2', settings.gradient_color)
					setIfProp('gradient', settings.gradient)
					setIfProp('outline', settings.outline)
					setIfProp('outlineSize', settings.outline_size)
					setColorIfProp('outlineColor', settings.outline_color)
					setColorIfProp('backgroundColor', settings.bk_color)
					setIfProp('backgroundOpacity', settings.bk_opacity)
					setIfProp('wrap', settings.extents_wrap)
					setIfProp('alignment', settings.align)
					setIfProp('verticalAlignment', settings.valign)
					setIfProp('extents', settings.extents)
					setIfProp('extentsWidth', settings.extents_cx)
					setIfProp('extentsHeight', settings.extents_cy)
					setIfProp('vertical', settings.vertical)
				} else {
					setColorIfProp('color1', settings.color1)
					setColorIfProp('color2', settings.color2)
					setIfProp('outline', settings.outline)
					setIfProp('dropShadow', settings.drop_shadow)
					setIfProp('wrap', settings.word_wrap)
				}

				return learnedOptions
			},
		},
		resetCaptureDevice: {
			name: 'Source - Reset Video Capture Device',
			description: 'Deactivates and Reactivates a Video Capture Source to reset it',
			options: [choiceDropdown(self, 'source', { id: 'source', label: 'Source' })],
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
			name: 'Filters - Set Visibility',
			description: 'Shows, hides, or toggles the enabled state of a filter on a source',
			options: [
				{
					type: 'checkbox',
					disableAutoExpression: true,
					label: 'All Sources',
					id: 'allSources',
					default: false,
				},
				choiceDropdown(self, 'sourceWithScenes', {
					id: 'source',
					label: 'Source',
					isVisibleExpression: `!$(options:allSources)`,
				}),
				choiceDropdown(self, 'filter', { id: 'filter', label: 'Filter' }),
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
			name: 'Filters - Set Settings',
			description: 'Sets the settings for a filter using a JSON object',
			options: [
				choiceDropdown(self, 'sourceWithScenes', { id: 'source', label: 'Source' }),
				choiceDropdown(self, 'filter', { id: 'filter', label: 'Filter' }),
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
				} catch (e) {
					logger.error(`Set Filter Settings Error: ${utils.describeError(e)}`)
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
			name: 'Source - Refresh Browser Source',
			description: 'Refreshes the cache of a specific browser source',
			options: [choiceDropdown(self, 'source', { id: 'source', label: 'Source' })],
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
			name: 'Source - Take Screenshot',
			description: 'Saves a screenshot of a specific source or scene to disk',
			options: [
				{
					type: 'checkbox',
					disableAutoExpression: true,
					label: 'Current Program Scene',
					id: 'useProgramScene',
					default: false,
				},
				{
					type: 'checkbox',
					disableAutoExpression: true,
					label: 'Current Preview Scene',
					id: 'usePreviewScene',
					default: false,
					isVisibleExpression: `!$(options:useProgramScene)`,
				},
				choiceDropdown(self, 'source', {
					id: 'source',
					label: 'Source',
					isVisibleExpression: `!$(options:useProgramScene) && !$(options:usePreviewScene)`,
				}),
				choiceDropdown(self, 'imageFormat', {
					id: 'format',
					label: 'Format',
					allowCustom: false,
					disableAutoExpression: true,
				}),
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
					disableAutoExpression: true,
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
					disableAutoExpression: true,
					label: 'Current Program Scene',
					id: 'useProgramScene',
					default: true,
				},
				choiceDropdown(self, 'scene', {
					id: 'scene',
					label: 'Scene',
					isVisibleExpression: `!$(options:useProgramScene)`,
				}),
				choiceDropdown(self, 'source', { id: 'source', label: 'Source' }),
				{
					type: 'multidropdown',
					disableAutoExpression: true,
					label: 'Properties',
					id: 'props',
					default: [],
					choices: [
						{ id: 'positionX', label: 'Position X' },
						{ id: 'positionY', label: 'Position Y' },
						{ id: 'scaleX', label: 'Scale X' },
						{ id: 'scaleY', label: 'Scale Y' },
						{ id: 'rotation', label: 'Rotation' },
					],
				},
				{
					type: 'textinput',
					label: 'Position X',
					id: 'positionX',
					default: '',
					useVariables: true,
					isVisibleExpression: `arrayIncludes($(options:props), 'positionX')`,
				},
				{
					type: 'textinput',
					label: 'Position Y',
					id: 'positionY',
					default: '',
					useVariables: true,
					isVisibleExpression: `arrayIncludes($(options:props), 'positionY')`,
				},
				{
					type: 'textinput',
					label: 'Scale X',
					id: 'scaleX',
					default: '',
					useVariables: true,
					isVisibleExpression: `arrayIncludes($(options:props), 'scaleX')`,
				},
				{
					type: 'textinput',
					label: 'Scale Y',
					id: 'scaleY',
					default: '',
					useVariables: true,
					isVisibleExpression: `arrayIncludes($(options:props), 'scaleY')`,
				},
				{
					type: 'textinput',
					label: 'Rotation',
					id: 'rotation',
					default: '',
					useVariables: true,
					isVisibleExpression: `arrayIncludes($(options:props), 'rotation')`,
				},
			],
			callback: async (action) => {
				const sourceSceneName = action.options.useProgramScene ? self.states.programScene : action.options.scene
				const sourceName = action.options.source
				const props = action.options.props || []

				const transform: { [key: string]: number } = {}
				if (props.includes('positionX') && action.options.positionX)
					transform.positionX = Number(action.options.positionX)
				if (props.includes('positionY') && action.options.positionY)
					transform.positionY = Number(action.options.positionY)
				if (props.includes('scaleX') && action.options.scaleX) transform.scaleX = Number(action.options.scaleX)
				if (props.includes('scaleY') && action.options.scaleY) transform.scaleY = Number(action.options.scaleY)
				if (props.includes('rotation') && action.options.rotation) transform.rotation = Number(action.options.rotation)

				const matches = self.obsState.findSceneItemsByNameInScene(sourceSceneName, sourceName)
				if (matches.length === 0) {
					logger.warn(`Scene item not found for source: ${sourceName} in scene: ${sourceSceneName}`)
					return
				}

				try {
					// A source added to a scene more than once has an item per copy; all of them move.
					await self.obs.sendBatch(
						matches.map((match) => ({
							requestType: 'SetSceneItemTransform',
							requestData: {
								sceneUuid: match.containerUuid,
								sceneItemId: match.item.sceneItemId,
								sceneItemTransform: transform,
							},
						})),
					)
				} catch (e) {
					logger.error(`Set Scene Item Properties Error: ${utils.describeError(e)}`)
				}
			},
			learn: async (action) => {
				const sourceSceneName = action.options.useProgramScene ? self.states.programScene : action.options.scene
				const sourceName = action.options.source

				const match = self.obsState.findSceneItemByName(sourceSceneName, sourceName)
				if (!match) return undefined

				try {
					const res = await self.obs.sendRequest('GetSceneItemTransform', {
						sceneUuid: match.containerUuid,
						sceneItemId: match.item.sceneItemId,
					})
					const sceneItemTransform = res?.sceneItemTransform
					if (!sceneItemTransform) return undefined

					const props = action.options.props || []
					const learnedOptions: Record<string, unknown> = {}

					/** OBS reports transform values as numbers; String() would stringify undefined as 'undefined'. */
					const setIfProp = (prop: string, value: unknown): void => {
						if (!props.includes(prop)) return
						const num = utils.asNumber(value)
						if (num !== undefined) learnedOptions[prop] = String(num)
					}

					setIfProp('positionX', sceneItemTransform.positionX)
					setIfProp('positionY', sceneItemTransform.positionY)
					setIfProp('scaleX', sceneItemTransform.scaleX)
					setIfProp('scaleY', sceneItemTransform.scaleY)
					setIfProp('rotation', sceneItemTransform.rotation)

					return learnedOptions
				} catch (e) {
					logger.error(`Learn Scene Item Properties Error: ${utils.describeError(e)}`)
					return undefined
				}
			},
		},

		toggle_scene_item: {
			name: 'Source - Set Visibility',
			description:
				'Shows, hides, or toggles the visibility of sources in the specified scene(s). With All Sources checked, every source in the chosen scene or group is set, and the excepted sources are set to the opposite visibility (ignored when Visibility is Toggle).',
			options: [
				{
					type: 'dropdown',
					disableAutoExpression: true,
					label: 'Target',
					id: 'target',
					default: 'allScenes',
					choices: [
						{ id: 'allScenes', label: 'All Scenes' },
						{ id: 'currentScene', label: 'Current Scene' },
						{ id: 'scene', label: 'Specific Scene' },
						{ id: 'group', label: 'Group' },
					],
				},
				choiceDropdown(self, 'scene', {
					id: 'scene',
					label: 'Scene',
					isVisibleExpression: `$(options:target) == 'scene'`,
				}),
				choiceDropdown(self, 'group', {
					id: 'group',
					label: 'Group',
					isVisibleExpression: `$(options:target) == 'group'`,
				}),
				{
					type: 'checkbox',
					disableAutoExpression: true,
					label: 'All Sources',
					id: 'allSources',
					default: false,
				},
				choiceMultiDropdown(self, 'source', {
					id: 'source',
					label: 'Sources',
					isVisibleExpression: '!$(options:allSources)',
				}),
				choiceMultiDropdown(self, 'source', {
					id: 'except',
					label: 'Except',
					isVisibleExpression: '$(options:allSources)',
				}),
				{
					type: 'checkbox',
					disableAutoExpression: true,
					label: 'Include Sources Inside Groups',
					id: 'includeGroupChildren',
					default: true,
					// OBS has no nested groups, so a group target has nothing further to descend into.
					isVisibleExpression: `$(options:allSources) && $(options:target) != 'group'`,
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
				if (action.options.allSources) {
					await self.obs.setAllSourcesVisibility(action.options.visible, {
						target: action.options.target,
						scene: action.options.scene,
						group: action.options.group,
						except: action.options.except,
						includeGroupChildren: action.options.includeGroupChildren,
					})
					return
				}

				await self.obs.setSourcesVisibility(action.options.source, action.options.visible, {
					target: action.options.target,
					scene: action.options.scene,
					group: action.options.group,
				})
			},
			learn: (action) => {
				// Only a single source in a single scene has one visibility to read back.
				if (action.options.allSources || action.options.target === 'allScenes') return undefined
				if (action.options.target === 'group') return undefined
				const sceneName = action.options.target === 'currentScene' ? self.states.programScene : action.options.scene
				// A multi-source selection has no single visibility to learn, so only a lone source is learnable.
				const sources = action.options.source
				if (!Array.isArray(sources) || sources.length !== 1) return undefined
				const match = self.obsState.findSceneItemByName(sceneName, sources[0])
				if (!match) return undefined
				return {
					visible: match.item.sceneItemEnabled ? 'true' : 'false',
				}
			},
		},
	}
}
