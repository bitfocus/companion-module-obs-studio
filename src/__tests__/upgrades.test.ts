import { describe, expect, test } from 'vitest'
import type {
	CompanionStaticUpgradeProps,
	CompanionUpgradeContext,
	CompanionMigrationAction,
	CompanionMigrationFeedback,
} from '@companion-module/base'
import upgrades from '../upgrades.js'
import { ObsAudioMonitorType } from '../types.js'
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

describe('v4_0_0 toggle_scene_item "All Sources" migration', () => {
	test('migrates an "All Sources" toggle_scene_item to the allSources mode', () => {
		const action = {
			id: 'a1',
			actionId: 'toggle_scene_item',
			options: { all: true, source: 'allSources', scene: 'Scene A', visible: 'false' },
		} as unknown as CompanionMigrationAction
		const result = v4_0_0(context, makeProps(null, [action]))

		expect(result.updatedActions).toHaveLength(1)
		const updated = result.updatedActions[0]
		expect(updated.actionId).toBe('toggle_scene_item')
		expect(updated.options.allSources).toBe(true)
		expect(updated.options.all).toBeUndefined()
		expect(updated.options.source).toEqual([])
		expect(updated.options.anyScene).toBeUndefined()
		expect(updated.options.target).toBe('scene')
		expect(updated.options.scene).toBe('Scene A')
		expect(updated.options.except).toEqual([])
		expect(updated.options.includeGroupChildren).toBe(true)
		expect(updated.options.group).toBe('')
	})

	test('maps "Current Scene" to the current-scene target', () => {
		const action = {
			id: 'a1',
			actionId: 'toggle_scene_item',
			options: { all: true, scene: 'Current Scene', visible: 'true' },
		} as unknown as CompanionMigrationAction
		const result = v4_0_0(context, makeProps(null, [action]))

		expect(result.updatedActions[0].options.target).toBe('currentScene')
	})

	test('maps "Preview Scene" to the preview scene variable', () => {
		const action = {
			id: 'a1',
			actionId: 'toggle_scene_item',
			options: { all: true, scene: 'Preview Scene', visible: 'true' },
		} as unknown as CompanionMigrationAction
		const result = v4_0_0(context, makeProps(null, [action]))

		expect(result.updatedActions[0].options.target).toBe('scene')
		expect(result.updatedActions[0].options.scene).toBe('$(obs:scene_preview)')
	})

	test('wraps a single-source toggle_scene_item selection into a list', () => {
		const action = {
			id: 'a1',
			actionId: 'toggle_scene_item',
			options: { all: false, source: 'Camera', scene: 'Scene A', visible: 'toggle' },
		} as unknown as CompanionMigrationAction
		const result = v4_0_0(context, makeProps(null, [action]))

		const updated = result.updatedActions[0]
		expect(updated.options.allSources).toBe(false)
		expect(updated.options.source).toEqual(['Camera'])
		expect(updated.options.all).toBeUndefined()
	})

	test('leaves an expression-bound source alone', () => {
		const action = {
			id: 'a1',
			actionId: 'toggle_scene_item',
			options: {
				all: false,
				source: { value: '$(internal:custom_cam)', isExpression: true },
				scene: 'Scene A',
				visible: 'toggle',
			},
		} as unknown as CompanionMigrationAction
		const result = v4_0_0(context, makeProps(null, [action]))

		expect(result.updatedActions[0].options.source).toEqual({ value: '$(internal:custom_cam)', isExpression: true })
	})
})

describe('v4_0_0 action consolidation', () => {
	function upgradeAction(actionId: string, options: Record<string, unknown>) {
		const action = { id: 'a1', actionId, options } as unknown as CompanionMigrationAction
		const result = v4_0_0(context, makeProps(null, [action]))
		expect(result.updatedActions).toHaveLength(1)
		return result.updatedActions[0]
	}

	test.each([
		['start_recording', 'recording', 'start'],
		['stop_recording', 'recording', 'stop'],
		['ToggleRecordPause', 'recording', 'toggle_pause'],
		['SplitRecordFile', 'recording', 'split'],
		['StartStopStreaming', 'streaming', 'toggle'],
		['save_replay_buffer', 'replay_buffer', 'save'],
		['start_stop_output', 'output', 'toggle'],
	])('maps %s onto %s', (oldId, newId, expected) => {
		const updated = upgradeAction(oldId, {})
		expect(updated.actionId).toBe(newId)
		expect(updated.options.action).toBe(expected)
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

	test('migrates adjust_volume_percent to the percent unit', () => {
		const updated = upgradeAction('adjust_volume_percent', { source: 'Mic', volume: 5 })
		expect(updated.options).toEqual({ source: 'Mic', mode: 'adjust', unit: 'percent', amount: 5 })
	})

	test('migrates set_volume to an instant set', () => {
		const updated = upgradeAction('set_volume', { source: 'Mic', volume: -6 })
		expect(updated.options).toEqual({ source: 'Mic', mode: 'set', unit: 'db', value: -6, duration: 0 })
	})

	test('keeps the fade duration when migrating fadeVolume', () => {
		const updated = upgradeAction('fadeVolume', { source: 'Mic', volume: -6, duration: 1000 })
		expect(updated.options).toEqual({ source: 'Mic', mode: 'set', unit: 'db', value: -6, duration: 1000 })
	})

	test('renames the set_transition_duration option', () => {
		const updated = upgradeAction('set_transition_duration', { duration: 250 })
		expect(updated.actionId).toBe('transition_duration')
		expect(updated.options).toEqual({ mode: 'set', value: 250 })
	})

	test.each([
		['next', 'next'],
		['previous', 'previous'],
	])('maps an adjustPreviewScene %s onto the preview_scene mode', (adjust, expected) => {
		const updated = upgradeAction('adjustPreviewScene', { adjust })
		expect(updated.actionId).toBe('preview_scene')
		expect(updated.options).toEqual({ mode: expected })
	})

	test('maps the legacy previewNextScene through to the combined action', () => {
		const updated = upgradeAction('previewNextScene', {})
		expect(updated.actionId).toBe('preview_scene')
		expect(updated.options.mode).toBe('next')
	})

	test('maps an adjustTransitionType onto the transition_type mode', () => {
		const updated = upgradeAction('adjustTransitionType', { adjust: 'previous' })
		expect(updated.actionId).toBe('transition_type')
		expect(updated.options).toEqual({ mode: 'previous' })
	})

	test('defaults the mode to next when the old adjust option was never set', () => {
		const updated = upgradeAction('adjustPreviewScene', {})
		expect(updated.actionId).toBe('preview_scene')
		expect(updated.options).toEqual({ mode: 'next' })
	})

	test('carries an expression-valued adjust across to the mode option', () => {
		const updated = upgradeAction('adjustTransitionType', {
			adjust: { isExpression: true, value: '$(internal:custom_direction)' },
		})
		expect(updated.actionId).toBe('transition_type')
		expect(updated.options).toEqual({ mode: { isExpression: true, value: '$(internal:custom_direction)' } })
	})

	test('migrates an option stored in the expanded value shape', () => {
		const updated = upgradeAction('adjust_volume', {
			source: { isExpression: true, value: '$(internal:custom_source)' },
			volume: { isExpression: false, value: 3 },
		})
		expect(updated.options).toEqual({
			source: { isExpression: true, value: '$(internal:custom_source)' },
			mode: 'adjust',
			unit: 'db',
			amount: { isExpression: false, value: 3 },
		})
	})

	test.each([
		['restart_media', 'restart'],
		['stop_media', 'stop'],
		['next_media', 'next'],
		['previous_media', 'previous'],
	])('maps %s onto media_control', (oldId, expected) => {
		const updated = upgradeAction(oldId, { useCurrentMedia: false, source: 'Clip' })
		expect(updated.actionId).toBe('media_control')
		expect(updated.options).toEqual({ target: 'source', source: 'Clip', action: expected })
	})

	test('renames the play_pause_media dropdown, keeping its value', () => {
		const updated = upgradeAction('play_pause_media', { useCurrentMedia: true, source: '', playPause: 'pause' })
		expect(updated.actionId).toBe('media_control')
		expect(updated.options).toEqual({ target: 'newest', source: '', action: 'pause' })
	})

	test('migrates set_media_time and scrub_media onto media_time', () => {
		const set = upgradeAction('set_media_time', { useCurrentMedia: true, source: '', mediaTime: 5000 })
		expect(set.actionId).toBe('media_time')
		expect(set.options).toEqual({ target: 'newest', source: '', mode: 'set', value: 5000 })

		const scrub = upgradeAction('scrub_media', { useCurrentMedia: true, source: '', scrubAmount: -5 })
		expect(scrub.actionId).toBe('media_time')
		expect(scrub.options).toEqual({ target: 'newest', source: '', mode: 'adjust', amount: -5 })
	})

	test('leaves an action outside the consolidated families untouched', () => {
		const result = v4_0_0(
			context,
			makeProps(null, [{ id: 'a1', actionId: 'do_transition', options: {} } as unknown as CompanionMigrationAction]),
		)
		expect(result.updatedActions).toHaveLength(0)
	})
})

describe('v4_0_0 audio monitoring migration', () => {
	function monitorAction(monitor: unknown): CompanionMigrationAction {
		return {
			id: 'a1',
			actionId: 'set_audio_monitor',
			options: { source: 'Mic', monitor },
		} as unknown as CompanionMigrationAction
	}

	function monitorFeedback(monitor: unknown): CompanionMigrationFeedback {
		return {
			id: 'f1',
			feedbackId: 'audio_monitor_type',
			options: { source: 'Mic', monitor },
		} as unknown as CompanionMigrationFeedback
	}

	test.each([
		[ObsAudioMonitorType.None, 'false'],
		[ObsAudioMonitorType.MonitorOnly, 'true'],
		[ObsAudioMonitorType.MonitorAndOutput, 'true'],
	])('converts the %s action option to %s', (monitor, expected) => {
		const result = v4_0_0(context, makeProps(null, [monitorAction(monitor)]))

		expect(result.updatedActions).toHaveLength(1)
		expect(result.updatedActions[0].options.monitor).toBe(expected)
	})

	function upgradeFeedback(feedback: CompanionMigrationFeedback) {
		const props = makeProps(null)
		props.feedbacks = [feedback]
		return v4_0_0(context, props)
	}

	test.each([ObsAudioMonitorType.MonitorOnly, ObsAudioMonitorType.MonitorAndOutput])(
		'drops the %s feedback option without inverting',
		(monitor) => {
			const result = upgradeFeedback(monitorFeedback(monitor))

			expect(result.updatedFeedbacks).toHaveLength(1)
			expect(result.updatedFeedbacks[0].options.monitor).toBeUndefined()
			expect(result.updatedFeedbacks[0].isInverted).toBeUndefined()
		},
	)

	test('inverts a feedback that matched "Off"', () => {
		const result = upgradeFeedback(monitorFeedback(ObsAudioMonitorType.None))

		expect(result.updatedFeedbacks).toHaveLength(1)
		expect(result.updatedFeedbacks[0].options.monitor).toBeUndefined()
		expect(result.updatedFeedbacks[0].isInverted).toEqual({ isExpression: false, value: true })
	})

	test('un-inverts a feedback that matched "Off" while already inverted', () => {
		const feedback = monitorFeedback(ObsAudioMonitorType.None)
		feedback.isInverted = { isExpression: false, value: true }
		const result = upgradeFeedback(feedback)

		expect(result.updatedFeedbacks[0].isInverted).toEqual({ isExpression: false, value: false })
	})

	test('leaves an expression-driven inversion alone', () => {
		const feedback = monitorFeedback(ObsAudioMonitorType.None)
		feedback.isInverted = { isExpression: true, value: '$(obs:monitor_Mic)' }
		const result = upgradeFeedback(feedback)

		expect(result.updatedFeedbacks[0].isInverted).toEqual({ isExpression: true, value: '$(obs:monitor_Mic)' })
	})

	test('leaves an already converted feedback untouched', () => {
		const feedback = { id: 'f1', feedbackId: 'audio_monitor_type', options: { source: 'Mic' } }
		const result = upgradeFeedback(feedback as unknown as CompanionMigrationFeedback)

		expect(result.updatedFeedbacks).toHaveLength(0)
	})

	test('converts an option stored in the expanded value shape', () => {
		const action = monitorAction({ isExpression: false, value: ObsAudioMonitorType.MonitorAndOutput })
		const result = v4_0_0(context, makeProps(null, [action]))

		expect(result.updatedActions[0].options.monitor).toEqual({ isExpression: false, value: 'true' })
	})

	test.each(['true', 'false', 'toggle'])('leaves an already converted value (%s) untouched', (monitor) => {
		const result = v4_0_0(context, makeProps(null, [monitorAction(monitor)]))

		expect(result.updatedActions).toHaveLength(0)
	})

	test('leaves an expression untouched', () => {
		const action = monitorAction({ isExpression: true, value: '$(obs:monitor_Mic)' })
		const result = v4_0_0(context, makeProps(null, [action]))

		expect(result.updatedActions).toHaveLength(0)
	})
})

describe('v4_0_0 media target migration', () => {
	const makeAction = (actionId: string, useCurrentMedia: boolean): CompanionMigrationAction =>
		({
			id: 'a1',
			controlId: 'ctl1',
			actionId,
			options: { useCurrentMedia, source: 'Clip' },
		}) as unknown as CompanionMigrationAction

	test.each(['media_control', 'media_time', 'updateMediaLocalFile'])(
		'%s with the checkbox set targets the newest playing clip',
		(actionId) => {
			const action = makeAction(actionId, true)
			const result = v4_0_0(context, makeProps(null, [action]))

			expect(result.updatedActions).toEqual([action])
			expect(action.options).toEqual({ source: 'Clip', target: 'newest' })
		},
	)

	test.each(['media_control', 'media_time', 'updateMediaLocalFile'])(
		'%s without the checkbox targets its named source',
		(actionId) => {
			const action = makeAction(actionId, false)
			v4_0_0(context, makeProps(null, [action]))

			expect(action.options).toEqual({ source: 'Clip', target: 'source' })
		},
	)

	test('an already-migrated action is left alone', () => {
		const action = {
			id: 'a1',
			controlId: 'ctl1',
			actionId: 'media_control',
			options: { target: 'all', source: '' },
		} as unknown as CompanionMigrationAction
		const result = v4_0_0(context, makeProps(null, [action]))

		expect(result.updatedActions).toEqual([])
		expect(action.options).toEqual({ target: 'all', source: '' })
	})
})

describe('v4_0_0 advanced feedback conversion', () => {
	const makeFeedback = (feedbackId: string, options: Record<string, unknown>): CompanionMigrationFeedback => ({
		id: 'fb1',
		controlId: 'ctl1',
		feedbackId,
		options: options as CompanionMigrationFeedback['options'],
	})

	test('converts a program scene_active to the program boolean, keeping its colors', () => {
		const feedback = makeFeedback('scene_active', {
			mode: 'program',
			scene: 'Scene A',
			fg: 1,
			bg: 2,
			fg_preview: 3,
			bg_preview: 4,
		})
		const result = v4_0_0(context, makeProps(null, [], [feedback]))

		expect(result.updatedFeedbacks).toEqual([feedback])
		expect(feedback.feedbackId).toBe('sceneProgram')
		expect(feedback.style).toEqual({ color: 1, bgcolor: 2 })
		expect(feedback.options).toEqual({ scene: 'Scene A' })
	})

	test('converts a preview-only scene_active to the preview boolean', () => {
		const feedback = makeFeedback('scene_active', { mode: 'preview', scene: 'Scene B', fg_preview: 3, bg_preview: 4 })
		v4_0_0(context, makeProps(null, [], [feedback]))

		expect(feedback.feedbackId).toBe('scenePreview')
		expect(feedback.style).toEqual({ color: 3, bgcolor: 4 })
	})

	test('converts a programAndPreview scene_active to the program boolean', () => {
		const feedback = makeFeedback('scene_active', { mode: 'programAndPreview', scene: 'Scene A', fg: 1, bg: 2 })
		v4_0_0(context, makeProps(null, [], [feedback]))

		expect(feedback.feedbackId).toBe('sceneProgram')
		expect(feedback.style).toEqual({ color: 1, bgcolor: 2 })
	})

	test('converts audioMeter to audioPeaking, keeping source and threshold', () => {
		const feedback = makeFeedback('audioMeter', { source: 'Mic', threshold: -50 })
		v4_0_0(context, makeProps(null, [], [feedback]))

		expect(feedback.feedbackId).toBe('audioPeaking')
		expect(feedback.options).toEqual({ source: 'Mic', threshold: -50 })
		expect(feedback.style).toEqual({ color: Color.White, bgcolor: Color.Green })
	})

	test('converts streamCongestion to the boolean, keeping the high-congestion color', () => {
		const feedback = makeFeedback('streamCongestion', {
			colorNoStream: 1,
			colorLow: 2,
			colorMedium: 3,
			colorHigh: 4,
		})
		v4_0_0(context, makeProps(null, [], [feedback]))

		expect(feedback.feedbackId).toBe('streamCongestionAbove')
		expect(feedback.style).toEqual({ color: Color.White, bgcolor: 4 })
		expect(feedback.options).toEqual({ threshold: 67 })
	})

	test('leaves feedbacks it does not convert alone', () => {
		const feedback = makeFeedback('streaming', {})
		const result = v4_0_0(context, makeProps(null, [], [feedback]))

		expect(result.updatedFeedbacks).toEqual([])
		expect(feedback.feedbackId).toBe('streaming')
	})
})
