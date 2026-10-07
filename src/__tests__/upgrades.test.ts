import { describe, expect, test } from 'vitest'
import type {
	CompanionStaticUpgradeProps,
	CompanionUpgradeContext,
	CompanionMigrationAction,
	CompanionMigrationFeedback,
	CompanionMigrationOptionValues,
} from '@companion-module/base'
import upgrades from '../upgrades.js'
import { Color } from '../utils.js'
import type { LegacyModuleConfig, ModuleConfig, ModuleSecrets } from '../types.js'

const context = {} as CompanionUpgradeContext<ModuleConfig>

function makeProps(
	config: ModuleConfig | null,
	actions: CompanionMigrationAction[] = [],
	feedbacks: CompanionMigrationFeedback[] = [],
): CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets> {
	return {
		config,
		secrets: null,
		actions,
		feedbacks,
	}
}

// Index 1 is the v2_0_0 script (index 0 is the generated boolean-feedback conversion).
const v2_0_0 = upgrades[1]
// v4_0_0 is the last script in the list.
const v4_0_0 = upgrades[upgrades.length - 1]

function makeLegacyProps(
	config: LegacyModuleConfig | null,
	secrets: ModuleSecrets | null,
): CompanionStaticUpgradeProps<LegacyModuleConfig, ModuleSecrets> {
	return { config, secrets, actions: [], feedbacks: [] }
}

describe('v2_0_0 port migration', () => {
	test('migrates the legacy default port 4444 to 4455', () => {
		const props = makeProps({ host: '127.0.0.1', port: 4444 })
		const result = v2_0_0(context, props)
		expect(result.updatedConfig?.port).toBe(4455)
	})

	test('sets the port when it is missing', () => {
		const props = makeProps({ host: '127.0.0.1' } as ModuleConfig)
		const result = v2_0_0(context, props)
		expect(result.updatedConfig?.port).toBe(4455)
	})

	test('leaves a custom port untouched', () => {
		const props = makeProps({ host: '127.0.0.1', port: 4456 })
		const result = v2_0_0(context, props)
		expect(result.updatedConfig).toBeNull()
	})

	test('does nothing when there is no config', () => {
		const result = v2_0_0(context, makeProps(null))
		expect(result.updatedConfig).toBeNull()
	})
})

describe('v2_0_0 action migration', () => {
	test('renames legacy text actions to setText', () => {
		const action = { id: 'a1', actionId: 'set-freetype-text', options: {} } as CompanionMigrationAction
		const result = v2_0_0(context, makeProps(null, [action]))
		expect(result.updatedActions).toHaveLength(1)
		expect(result.updatedActions[0].actionId).toBe('setText')
	})
})

describe('v4_0_0 password migration', () => {
	test('moves a config password into secrets and strips it from config', () => {
		const props = makeLegacyProps({ host: '127.0.0.1', port: 4455, pass: 'hunter2' }, null)
		const result = v4_0_0(context, props)

		expect(result.updatedSecrets).toEqual({ pass: 'hunter2' })
		expect(result.updatedConfig).not.toBeNull()
		expect(result.updatedConfig).not.toHaveProperty('pass')
	})

	test('keeps an existing secret and only strips the stale config copy', () => {
		const props = makeLegacyProps({ host: '127.0.0.1', port: 4455, pass: 'stale' }, { pass: 'current' })
		const result = v4_0_0(context, props)

		// The secret the user set under the new layout must win over the leftover config value.
		expect(result.updatedSecrets).toBeNull()
		expect(result.updatedConfig).not.toHaveProperty('pass')
	})

	test('does nothing when the config carries no password', () => {
		const result = v4_0_0(context, makeLegacyProps({ host: '127.0.0.1', port: 4455 }, null))

		expect(result.updatedSecrets).toBeNull()
		expect(result.updatedConfig).toBeNull()
	})

	test('does nothing when there is no config', () => {
		const result = v4_0_0(context, makeLegacyProps(null, null))

		expect(result.updatedSecrets).toBeNull()
		expect(result.updatedConfig).toBeNull()
	})
})

// Companion stores every v3 option wrapped before any upgrade script runs, so the v4 fixtures use that shape.
type Wrapped = { isExpression: boolean; value: unknown }

function isWrapped(value: unknown): value is Wrapped {
	return value !== null && typeof value === 'object' && 'isExpression' in value
}

/** Wraps each literal the way Companion stores it; values already given wrapped (expressions) are kept. */
function wrap(options: Record<string, unknown>): CompanionMigrationOptionValues {
	return Object.fromEntries(
		Object.entries(options).map(([key, value]) => [key, isWrapped(value) ? value : { isExpression: false, value }]),
	) as CompanionMigrationOptionValues
}

/**
 * Unwraps literal options for comparison, leaving expressions in their wrapped form. Fails on any bare
 * value, since Companion would read it back as missing.
 */
function plain(options: CompanionMigrationOptionValues): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(options).map(([key, value]) => {
			expect(isWrapped(value), `option '${key}' must be wrapped`).toBe(true)
			const wrapped = value as Wrapped
			return [key, wrapped.isExpression ? wrapped : wrapped.value]
		}),
	)
}

function upgradeAction(actionId: string, options: Record<string, unknown>) {
	const action = { id: 'a1', controlId: 'ctl1', actionId, options: wrap(options) } as CompanionMigrationAction
	const result = v4_0_0(context, makeProps(null, [action]))
	expect(result.updatedActions).toHaveLength(1)
	const updated = result.updatedActions[0]
	return { actionId: updated.actionId, options: plain(updated.options) }
}

function upgradeFeedback(feedbackId: string, options: Record<string, unknown>, isInverted?: Wrapped) {
	const feedback = {
		id: 'f1',
		controlId: 'ctl1',
		feedbackId,
		options: wrap(options),
		...(isInverted ? { isInverted } : {}),
	} as CompanionMigrationFeedback
	const result = v4_0_0(context, makeProps(null, [], [feedback]))
	return { result, feedback, options: plain(feedback.options) }
}

describe('v4_0_0 toggle_scene_item migration', () => {
	test('migrates an "All Sources" toggle_scene_item to the allSources mode', () => {
		const updated = upgradeAction('toggle_scene_item', {
			all: true,
			source: 'Camera',
			scene: 'Scene A',
			visible: 'false',
		})
		expect(updated.actionId).toBe('toggle_scene_item')
		expect(updated.options).toEqual({
			target: 'scene',
			scene: 'Scene A',
			allSources: true,
			source: [],
			except: [],
			includeGroupChildren: 'groupsAndSources',
			group: '',
			visible: 'false',
		})
	})

	test('maps "Current Scene" to the current-scene target', () => {
		const updated = upgradeAction('toggle_scene_item', { all: false, source: 'Camera', scene: 'Current Scene' })
		expect(updated.options.target).toBe('currentScene')
	})

	test('maps "Preview Scene" to an expression reading the preview scene variable', () => {
		const updated = upgradeAction('toggle_scene_item', { all: false, source: 'Camera', scene: 'Preview Scene' })
		expect(updated.options.target).toBe('scene')
		expect(updated.options.scene).toEqual({ isExpression: true, value: '$(obs:scene_preview)' })
	})

	test('wraps a single-source selection into a list', () => {
		const updated = upgradeAction('toggle_scene_item', { all: false, source: 'Camera', scene: 'Scene A' })
		expect(updated.options.allSources).toBe(false)
		expect(updated.options.source).toEqual(['Camera'])
	})

	test('turns scene and source names carrying variables into expressions', () => {
		const updated = upgradeAction('toggle_scene_item', {
			all: false,
			source: 'Cam $(internal:custom_n)',
			scene: '$(internal:custom_scene)',
		})
		expect(updated.options.scene).toEqual({ isExpression: true, value: '$(internal:custom_scene)' })
		expect(updated.options.source).toEqual({
			isExpression: true,
			value: '[parseVariables("Cam $(internal:custom_n)")]',
		})
	})
})

describe('v4_0_0 action consolidation', () => {
	test.each([
		['start_recording', 'recording', 'start'],
		['stop_recording', 'recording', 'stop'],
		['ToggleRecordPause', 'recording', 'toggle_pause'],
		['StartStopRecording', 'recording', 'toggle'],
		['SplitRecordFile', 'recording', 'split'],
		['StartStopStreaming', 'streaming', 'toggle'],
		['save_replay_buffer', 'replay_buffer', 'save'],
		['start_stop_output', 'output', 'toggle'],
	])('maps %s onto %s', (oldId, newId, expected) => {
		const updated = upgradeAction(oldId, {})
		expect(updated.actionId).toBe(newId)
		expect(updated.options.action).toBe(expected)
	})

	test('keeps the chapter name when migrating CreateRecordChapter', () => {
		const updated = upgradeAction('CreateRecordChapter', { chapterName: 'Intro' })
		expect(updated.options).toEqual({ chapterName: 'Intro', action: 'chapter' })
	})

	test.each([
		['enable_studio_mode', 'true'],
		['disable_studio_mode', 'false'],
		['toggle_studio_mode', 'toggle'],
	])('maps %s onto studio_mode', (oldId, expected) => {
		const updated = upgradeAction(oldId, {})
		expect(updated.actionId).toBe('studio_mode')
		expect(updated.options.enabled).toBe(expected)
	})

	test('maps toggle_source_mute onto mute with a toggle option', () => {
		const updated = upgradeAction('toggle_source_mute', { source: 'Mic' })
		expect(updated.actionId).toBe('mute')
		expect(updated.options).toEqual({ source: 'Mic', mute: 'toggle' })
	})

	test('keeps the existing mute value when migrating set_source_mute', () => {
		const updated = upgradeAction('set_source_mute', { source: 'Mic', mute: 'false' })
		expect(updated.actionId).toBe('mute')
		expect(updated.options.mute).toBe('false')
	})

	test('renames the adjust_volume amount and marks the mode and unit', () => {
		const updated = upgradeAction('adjust_volume', { source: 'Mic', volume: 3 })
		expect(updated.actionId).toBe('volume')
		expect(updated.options).toEqual({ source: 'Mic', mode: 'adjust', unit: 'db', amount: 3 })
	})

	test('carries the adjust_volume_percent percentage into the amount', () => {
		const updated = upgradeAction('adjust_volume_percent', { source: 'Mic', percent: 10 })
		expect(updated.options).toEqual({ source: 'Mic', mode: 'adjust', unit: 'percent', amount: 10 })
	})

	test('migrates set_volume to an instant set', () => {
		const updated = upgradeAction('set_volume', { source: 'Mic', volume: -6 })
		expect(updated.options).toEqual({ source: 'Mic', mode: 'set', unit: 'db', value: -6, duration: 0 })
	})

	test('keeps the fade duration when migrating fadeVolume', () => {
		const updated = upgradeAction('fadeVolume', { source: 'Mic', volume: -6, duration: 1000 })
		expect(updated.options).toEqual({ source: 'Mic', mode: 'set', unit: 'db', value: -6, duration: 1000 })
	})

	test('migrates setSyncOffset and setAudioBalance onto their set modes', () => {
		expect(upgradeAction('setSyncOffset', { source: 'Mic', offset: 120 })).toEqual({
			actionId: 'audio_offset',
			options: { source: 'Mic', mode: 'set', value: 120 },
		})
		expect(upgradeAction('setAudioBalance', { source: 'Mic', balance: 0.25 })).toEqual({
			actionId: 'audio_balance',
			options: { source: 'Mic', mode: 'set', value: 0.25 },
		})
	})

	test('parses the free-text adjust amounts of adjustSyncOffset and adjustAudioBalance', () => {
		expect(upgradeAction('adjustSyncOffset', { source: 'Mic', offset: '-20' })).toEqual({
			actionId: 'audio_offset',
			options: { source: 'Mic', mode: 'adjust', amount: -20 },
		})
		expect(upgradeAction('adjustAudioBalance', { source: 'Mic', offset: '0.1' })).toEqual({
			actionId: 'audio_balance',
			options: { source: 'Mic', mode: 'adjust', amount: 0.1 },
		})
	})

	test('migrates set_transition onto the transition_type set mode', () => {
		expect(upgradeAction('set_transition', { transitions: 'Fade' })).toEqual({
			actionId: 'transition_type',
			options: { transitions: 'Fade', mode: 'set' },
		})
	})

	test('turns a set_transition name carrying variables into an expression', () => {
		const updated = upgradeAction('set_transition', { transitions: '$(internal:custom_transition)' })
		expect(updated.options.transitions).toEqual({ isExpression: true, value: '$(internal:custom_transition)' })
	})

	test('renames the set_transition_duration option and drops the variable fields', () => {
		const updated = upgradeAction('set_transition_duration', {
			duration: 250,
			useVariable: false,
			variableValue: '500',
		})
		expect(updated.actionId).toBe('transition_duration')
		expect(updated.options).toEqual({ mode: 'set', value: 250 })
	})

	test('folds a set_transition_duration variable into an expression', () => {
		const updated = upgradeAction('set_transition_duration', {
			duration: 500,
			useVariable: true,
			variableValue: '$(internal:custom_duration)',
		})
		expect(updated.options).toEqual({
			mode: 'set',
			value: { isExpression: true, value: '$(internal:custom_duration)' },
		})
	})

	test('migrates adjustTransitionDuration onto the transition_duration adjust mode', () => {
		expect(upgradeAction('adjustTransitionDuration', { duration: -100 })).toEqual({
			actionId: 'transition_duration',
			options: { mode: 'adjust', amount: -100 },
		})
	})

	test.each([
		['previewNextScene', 'next'],
		['previewPreviousScene', 'previous'],
	])('maps the legacy %s through to the combined action', (oldId, expected) => {
		const updated = upgradeAction(oldId, {})
		expect(updated.actionId).toBe('preview_scene')
		expect(updated.options.mode).toBe(expected)
	})

	test('maps an adjustTransitionType onto the transition_type mode', () => {
		const updated = upgradeAction('adjustTransitionType', { adjust: 'previous' })
		expect(updated.actionId).toBe('transition_type')
		expect(updated.options).toEqual({ mode: 'previous' })
	})

	test('defaults the mode to next when the old adjust option was never set', () => {
		const updated = upgradeAction('adjustTransitionType', {})
		expect(updated.options).toEqual({ mode: 'next' })
	})

	test.each([
		['restart_media', 'restart'],
		['stop_media', 'stop'],
		['next_media', 'next'],
		['previous_media', 'previous'],
	])('maps %s onto media_control', (oldId, expected) => {
		const updated = upgradeAction(oldId, { source: 'Clip' })
		expect(updated.actionId).toBe('media_control')
		expect(updated.options).toEqual({ target: 'source', source: 'Clip', action: expected })
	})

	test.each([
		['toggle', 'toggle'],
		['false', 'play'],
		['true', 'pause'],
	])('maps the play_pause_media choice %s onto %s', (playPause, expected) => {
		const updated = upgradeAction('play_pause_media', { source: 'Clip', playPause })
		expect(updated.actionId).toBe('media_control')
		expect(updated.options).toEqual({ target: 'source', source: 'Clip', action: expected })
	})

	test('converts the set_media_time seconds to milliseconds', () => {
		const updated = upgradeAction('set_media_time', { source: 'Clip', mediaTime: 30 })
		expect(updated.actionId).toBe('media_time')
		expect(updated.options).toEqual({ target: 'source', source: 'Clip', mode: 'set', value: 30000 })
	})

	test('keeps scrub_media in seconds', () => {
		const updated = upgradeAction('scrub_media', { source: 'Clip', scrubAmount: -5 })
		expect(updated.options).toEqual({ target: 'source', source: 'Clip', mode: 'adjust', amount: -5 })
	})

	test('renames the updateMediaLocalFile path', () => {
		const updated = upgradeAction('updateMediaLocalFile', { source: 'Clip', mediaFilePath: 'C:/clips/a.mp4' })
		expect(updated.options).toEqual({ target: 'source', source: 'Clip', path: 'C:/clips/a.mp4' })
	})

	test('renames the set_stream_settings authentication options', () => {
		const updated = upgradeAction('set_stream_settings', {
			streamType: 'rtmp_custom',
			streamURL: 'rtmp://example',
			streamKey: 'key',
			streamAuth: true,
			streamUserName: 'user',
			streamPassword: 'pass',
		})
		expect(updated.options).toEqual({
			streamType: 'rtmp_custom',
			streamURL: 'rtmp://example',
			streamKey: 'key',
			useAuth: true,
			username: 'user',
			password: 'pass',
		})
	})

	test('leaves an action outside the migrated families untouched', () => {
		const action = { id: 'a1', actionId: 'do_transition', options: {} } as unknown as CompanionMigrationAction
		expect(v4_0_0(context, makeProps(null, [action])).updatedActions).toHaveLength(0)
	})
})

describe('v4_0_0 custom scene names', () => {
	test.each(['set_scene', 'preview_scene', 'smart_switcher'])('%s moves a custom name into the scene', (actionId) => {
		const updated = upgradeAction(actionId, { scene: 'customSceneName', customSceneName: 'Interview' })
		expect(updated.options.scene).toBe('Interview')
		expect(updated.options.customSceneName).toBeUndefined()
	})

	test('turns a custom name carrying variables into an expression', () => {
		const updated = upgradeAction('set_scene', { scene: 'customSceneName', customSceneName: 'Cam $(internal:n)' })
		expect(updated.options.scene).toEqual({ isExpression: true, value: 'parseVariables("Cam $(internal:n)")' })
	})

	test('keeps a scene chosen from the list', () => {
		const updated = upgradeAction('set_scene', { scene: 'Scene A', customSceneName: '' })
		expect(updated.options).toEqual({ scene: 'Scene A' })
	})
})

describe('v4_0_0 audio monitoring migration', () => {
	test.each([
		['none', 'false'],
		['monitorOnly', 'true'],
		['monitorAndOutput', 'true'],
	])('converts the %s action option to %s', (monitor, expected) => {
		expect(upgradeAction('set_audio_monitor', { source: 'Mic', monitor }).options.monitor).toBe(expected)
	})

	test.each(['monitorOnly', 'monitorAndOutput'])('drops the %s feedback option without inverting', (monitor) => {
		const { result, feedback, options } = upgradeFeedback('audio_monitor_type', { source: 'Mic', monitor })
		expect(result.updatedFeedbacks).toHaveLength(1)
		expect(options).toEqual({ source: 'Mic' })
		expect(feedback.isInverted).toBeUndefined()
	})

	test('inverts a feedback that matched "None"', () => {
		const { feedback, options } = upgradeFeedback('audio_monitor_type', { source: 'Mic', monitor: 'none' })
		expect(options).toEqual({ source: 'Mic' })
		expect(feedback.isInverted).toEqual({ isExpression: false, value: true })
	})

	test('un-inverts a feedback that matched "None" while already inverted', () => {
		const { feedback } = upgradeFeedback(
			'audio_monitor_type',
			{ source: 'Mic', monitor: 'none' },
			{ isExpression: false, value: true },
		)
		expect(feedback.isInverted).toEqual({ isExpression: false, value: false })
	})

	test.each(['true', 'false', 'toggle'])('leaves an already converted value (%s) untouched', (monitor) => {
		const action = {
			id: 'a1',
			actionId: 'set_audio_monitor',
			options: wrap({ source: 'Mic', monitor }),
		} as unknown as CompanionMigrationAction
		expect(v4_0_0(context, makeProps(null, [action])).updatedActions).toHaveLength(0)
	})
})

describe('v4_0_0 media target migration', () => {
	test.each(['play_pause_media', 'restart_media', 'set_media_time', 'scrub_media', 'updateMediaLocalFile'])(
		'%s on the "current media" source targets the newest playing clip',
		(actionId) => {
			const updated = upgradeAction(actionId, { source: 'currentMedia' })
			expect(updated.options.target).toBe('newest')
			expect(updated.options.source).toBe('')
		},
	)

	test('an already-migrated action is left alone', () => {
		const action = {
			id: 'a1',
			controlId: 'ctl1',
			actionId: 'media_control',
			options: wrap({ target: 'all', source: '' }),
		} as unknown as CompanionMigrationAction
		expect(v4_0_0(context, makeProps(null, [action])).updatedActions).toEqual([])
	})
})

describe('v4_0_0 take_screenshot migration', () => {
	test.each([
		['programScene', 'programScene', ''],
		['Camera', 'source', 'Camera'],
	])('source %s becomes target %s', (source, target, newSource) => {
		const updated = upgradeAction('take_screenshot', { source, customName: false })
		expect(updated.options.target).toBe(target)
		expect(updated.options.source).toBe(newSource)
	})

	test('moves the "Custom" source choice across from its second dropdown', () => {
		const updated = upgradeAction('take_screenshot', { source: 'custom', custom: 'Camera', customName: false })
		expect(updated.options.target).toBe('source')
		expect(updated.options.source).toBe('Camera')
		expect(updated.options.custom).toBeUndefined()
	})

	test('joins a custom folder, file name and format into the full path', () => {
		const updated = upgradeAction('take_screenshot', {
			source: 'programScene',
			format: 'jpg',
			customName: true,
			path: 'D:/shots',
			fileName: 'Shot_$(internal:date_iso)',
		})
		expect(updated.options).toMatchObject({ customName: true, path: 'D:/shots/Shot_$(internal:date_iso).jpg' })
		expect(updated.options.fileName).toBeUndefined()
	})

	test('keeps a custom file name without a folder as a prefix in the recording folder', () => {
		const updated = upgradeAction('take_screenshot', {
			source: 'programScene',
			customName: true,
			path: '',
			fileName: 'Shot_',
		})
		expect(updated.options).toMatchObject({ customName: false, prefix: 'Shot_' })
	})

	test('gives a default-named screenshot the default prefix', () => {
		const updated = upgradeAction('take_screenshot', { source: 'programScene', customName: false })
		expect(updated.options.prefix).toBe('Screenshot ')
	})
})

describe('v4_0_0 target dropdown migrations', () => {
	test.each([
		['set_filter_visible', 'allSources', 'allSources'],
		['set_filter_visible', 'Camera', 'source'],
		['toggle_filter', 'allSources', 'allSources'],
		['toggle_filter', 'Camera', 'source'],
	])('%s source %s becomes target %s', (actionId, source, target) => {
		const updated = upgradeAction(actionId, { source, filter: 'Blur' })
		expect(updated.options.target).toBe(target)
		expect(updated.options.allSources).toBeUndefined()
		expect(updated.options.all).toBeUndefined()
	})

	test('toggle_filter "All" sets every filter on the chosen source', () => {
		const updated = upgradeAction('toggle_filter', { source: 'Camera', all: true, filter: 'Blur', visible: 'false' })
		expect(updated.options).toEqual({
			target: 'source',
			source: 'Camera',
			allFilters: true,
			filter: 'Blur',
			visible: 'false',
		})
	})

	test('toggle_filter without "All" keeps the single filter', () => {
		const updated = upgradeAction('toggle_filter', { source: 'Camera', all: false, filter: 'Blur', visible: 'true' })
		expect(updated.options).toMatchObject({ target: 'source', allFilters: false, filter: 'Blur' })
	})

	test.each([
		['Current Scene', 'programScene'],
		['current', 'programScene'],
		['Scene A', 'scene'],
	])('source_properties scene %s becomes target %s', (scene, target) => {
		const updated = upgradeAction('source_properties', { scene, source: 'Camera', positionX: '10' })
		expect(updated.options.target).toBe(target)
		expect(updated.options.props).toEqual(['positionX'])
	})

	test('source_properties on the preview scene reads the preview scene variable', () => {
		const updated = upgradeAction('source_properties', { scene: 'Preview Scene', source: 'Camera' })
		expect(updated.options.target).toBe('scene')
		expect(updated.options.scene).toEqual({ isExpression: true, value: '$(obs:scene_preview)' })
	})

	test('open_projector moves a scene projector scene into its own option', () => {
		const updated = upgradeAction('open_projector', { type: 'Scene', window: 'window', source: 'Scene A' })
		expect(updated.options.scene).toBe('Scene A')
	})

	test.each([
		[{ scene: 'anyScene' }, 'allScenes'],
		[{ scene: 'Scene A' }, 'scene'],
	])('scene_item_active %o becomes target %s', (options, target) => {
		const { options: updated } = upgradeFeedback('scene_item_active', { ...options, source: 'Camera' })
		expect(updated.target).toBe(target)
	})
})

describe('v4_0_0 feedback conversion', () => {
	test('converts a program scene_active to the program boolean, keeping its colors', () => {
		const { result, feedback, options } = upgradeFeedback('scene_active', {
			mode: 'program',
			scene: 'Scene A',
			fg: 1,
			bg: 2,
			fg_preview: 3,
			bg_preview: 4,
		})
		expect(result.updatedFeedbacks).toEqual([feedback])
		expect(feedback.feedbackId).toBe('sceneProgram')
		expect(feedback.style).toEqual({ color: 1, bgcolor: 2 })
		expect(options).toEqual({ scene: 'Scene A' })
	})

	test('converts a preview scene_active to the preview boolean', () => {
		const { feedback } = upgradeFeedback('scene_active', { mode: 'preview', scene: 'B', fg_preview: 3, bg_preview: 4 })
		expect(feedback.feedbackId).toBe('scenePreview')
		expect(feedback.style).toEqual({ color: 3, bgcolor: 4 })
	})

	test('converts the advanced recording feedback to the boolean, keeping its recording colors', () => {
		const { result, feedback, options } = upgradeFeedback('recording', { fg: 1, bg: 2, fg_paused: 3, bg_paused: 4 })
		expect(result.updatedFeedbacks).toEqual([feedback])
		expect(feedback.style).toEqual({ color: 1, bgcolor: 2 })
		expect(options).toEqual({})
	})

	test('converts audioMeter to audioPeaking, keeping source and threshold', () => {
		const { feedback, options } = upgradeFeedback('audioMeter', { source: 'Mic', threshold: -50 })
		expect(feedback.feedbackId).toBe('audioPeaking')
		expect(options).toEqual({ source: 'Mic', threshold: -50, peakHold: 0 })
		expect(feedback.style).toEqual({ color: Color.White, bgcolor: Color.Green })
	})

	test('renames the audioPeaking peak to the threshold and defaults its hold', () => {
		const { result, options } = upgradeFeedback('audioPeaking', { source: 'Mic', peak: -6 })
		expect(options).toEqual({ source: 'Mic', threshold: -6, peakHold: 0 })
		expect(result.updatedFeedbacks).toHaveLength(1)
	})

	test('converts streamCongestion to the boolean, keeping the high-congestion color', () => {
		const { feedback, options } = upgradeFeedback('streamCongestion', {
			colorNoStream: 1,
			colorLow: 2,
			colorMedium: 3,
			colorHigh: 4,
		})
		expect(feedback.feedbackId).toBe('streamCongestionAbove')
		expect(feedback.style).toEqual({ color: Color.White, bgcolor: 4 })
		expect(options).toEqual({ threshold: 67 })
	})

	test('leaves feedbacks it does not convert alone', () => {
		const { result, feedback } = upgradeFeedback('streaming', {})
		expect(result.updatedFeedbacks).toEqual([])
		expect(feedback.feedbackId).toBe('streaming')
	})
})
