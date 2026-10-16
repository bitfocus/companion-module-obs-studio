import { describe, expect, test, vi } from 'vitest'
import { InstanceStatus } from '@companion-module/base'
import OBSInstance from '../main.js'
import type { ModuleConfig } from '../types.js'

const NO_CONFIG: ModuleConfig = { host: '', port: 0 }

/** A host context that accepts every call, which is all the instance lifecycle needs from it. */
function makeInstance(): { instance: OBSInstance; updateStatus: ReturnType<typeof vi.fn> } {
	const updateStatus = vi.fn()
	const host: Record<string | symbol, unknown> = { id: 'test', label: 'test', _isInstanceContext: true, updateStatus }
	const context = new Proxy(host, { get: (target, prop) => (prop in target ? target[prop] : vi.fn()) })
	return { instance: new OBSInstance(context), updateStatus }
}

describe('configUpdated', () => {
	test('keeps the OBSApi, so feedback subscriptions survive a config change', async () => {
		const { instance } = makeInstance()
		await instance.init(NO_CONFIG, true, {})
		const api = instance.obs

		await instance.configUpdated(NO_CONFIG, {})

		expect(instance.obs).toBe(api)
	})

	test('starts from fresh state, since the new config may point at another OBS', async () => {
		const { instance } = makeInstance()
		await instance.init(NO_CONFIG, true, {})
		const state = instance.obsState

		await instance.configUpdated(NO_CONFIG, {})

		expect(instance.obsState).not.toBe(state)
	})

	test('reports the new config as bad when it is incomplete', async () => {
		const { instance, updateStatus } = makeInstance()
		await instance.init(NO_CONFIG, true, {})
		updateStatus.mockClear()

		await instance.configUpdated({ host: 'localhost', port: 0 }, {})

		expect(updateStatus).toHaveBeenLastCalledWith(InstanceStatus.BadConfig, 'Missing WebSocket Server port')
	})
})
