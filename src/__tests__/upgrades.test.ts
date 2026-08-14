import { describe, expect, test } from 'vitest'
import type {
	CompanionStaticUpgradeProps,
	CompanionUpgradeContext,
	CompanionMigrationAction,
} from '@companion-module/base'
import upgrades from '../upgrades.js'
import type { LegacyModuleConfig, ModuleConfig, ModuleSecrets } from '../types.js'

const context = {} as CompanionUpgradeContext<ModuleConfig>

function makeProps(
	config: ModuleConfig | null,
	actions: CompanionMigrationAction[] = [],
): CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets> {
	return {
		config,
		secrets: null,
		actions,
		feedbacks: [],
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
	test('migrates an "All Sources" toggle_scene_item to toggle_all_scene_items', () => {
		const action = {
			id: 'a1',
			actionId: 'toggle_scene_item',
			options: { all: true, source: 'allSources', scene: 'Scene A', visible: 'false' },
		} as unknown as CompanionMigrationAction
		const result = v4_0_0(context, makeProps(null, [action]))

		expect(result.updatedActions).toHaveLength(1)
		const updated = result.updatedActions[0]
		expect(updated.actionId).toBe('toggle_all_scene_items')
		expect(updated.options.all).toBeUndefined()
		expect(updated.options.source).toBeUndefined()
		expect(updated.options.anyScene).toBeUndefined()
		expect(updated.options.useCurrentScene).toBe(false)
		expect(updated.options.scene).toBe('Scene A')
		expect(updated.options.except).toEqual([])
	})

	test('maps "Current Scene" to useCurrentScene', () => {
		const action = {
			id: 'a1',
			actionId: 'toggle_scene_item',
			options: { all: true, scene: 'Current Scene', visible: 'true' },
		} as unknown as CompanionMigrationAction
		const result = v4_0_0(context, makeProps(null, [action]))

		expect(result.updatedActions[0].options.useCurrentScene).toBe(true)
	})

	test('maps "Preview Scene" to the preview scene variable', () => {
		const action = {
			id: 'a1',
			actionId: 'toggle_scene_item',
			options: { all: true, scene: 'Preview Scene', visible: 'true' },
		} as unknown as CompanionMigrationAction
		const result = v4_0_0(context, makeProps(null, [action]))

		expect(result.updatedActions[0].options.useCurrentScene).toBe(false)
		expect(result.updatedActions[0].options.scene).toBe('$(obs:scene_preview)')
	})

	test('leaves a single-source toggle_scene_item untouched', () => {
		const action = {
			id: 'a1',
			actionId: 'toggle_scene_item',
			options: { all: false, source: 'Camera', scene: 'Scene A', visible: 'toggle' },
		} as unknown as CompanionMigrationAction
		const result = v4_0_0(context, makeProps(null, [action]))

		expect(result.updatedActions).toHaveLength(0)
	})
})
