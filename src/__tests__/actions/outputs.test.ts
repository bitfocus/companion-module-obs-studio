import { beforeEach, describe, expect, test } from 'vitest'
import { getOutputActions } from '../../actions/outputs.js'
import { makeMockInstance, type MockInstance } from '../mock/instance.js'
import { actionEvent } from '../mock/events.js'
import { MockContext } from '../mock-context.js'
import { looseActions } from '../loose-definitions.js'

describe('set_stream_settings', () => {
	let self: MockInstance

	const defaults = {
		streamType: 'rtmp_common',
		service: '',
		server: '',
		streamURL: '',
		streamKey: '',
		useAuth: false,
		username: '',
		password: '',
		bearerToken: '',
	}

	beforeEach(() => {
		self = makeMockInstance()
	})

	const run = async (options: Record<string, unknown>) => {
		const actions = looseActions(getOutputActions(self))
		await actions['set_stream_settings'].callback(
			actionEvent('set_stream_settings', { ...defaults, ...options }),
			new MockContext(),
		)
	}

	const sentSettings = () =>
		self.socket.call.mock.calls.find(([type]) => type === 'SetStreamServiceSettings')?.[1] as
			{ streamServiceType: string; streamServiceSettings: Record<string, unknown> } | undefined

	test('a preset service with service and server switches all three settings', async () => {
		await run({ service: 'Twitch', server: 'auto', streamKey: 'live_123' })
		expect(sentSettings()).toEqual({
			streamServiceType: 'rtmp_common',
			streamServiceSettings: { service: 'Twitch', server: 'auto', key: 'live_123' },
		})
	})

	test('a preset service with service and server left empty only sends the key', async () => {
		await run({ streamKey: 'live_123' })
		expect(sentSettings()?.streamServiceSettings).toEqual({ key: 'live_123' })
	})

	test('custom RTMP sends the credentials only with authentication on', async () => {
		await run({ streamType: 'rtmp_custom', streamURL: 'rtmp://example/live', streamKey: 'k', username: 'u' })
		expect(sentSettings()).toEqual({
			streamServiceType: 'rtmp_custom',
			streamServiceSettings: { server: 'rtmp://example/live', key: 'k', use_auth: false },
		})
	})

	test('custom WHIP sends the server and bearer token', async () => {
		await run({ streamType: 'whip_custom', streamURL: 'https://example/whip', bearerToken: 't' })
		expect(sentSettings()?.streamServiceSettings).toEqual({
			server: 'https://example/whip',
			service: 'WHIP',
			bearer_token: 't',
		})
	})

	test('does nothing while streaming, as OBS would reject it', async () => {
		self.states.streaming = true
		await run({ service: 'Twitch', server: 'auto', streamKey: 'live_123' })
		expect(sentSettings()).toBeUndefined()
	})

	describe('learn', () => {
		const learn = async (response: unknown, signal?: AbortSignal) => {
			self.socket.call.mockImplementation(async (type: string) => (type === 'GetStreamServiceSettings' ? response : {}))
			const actions = looseActions(getOutputActions(self))
			return actions['set_stream_settings'].learn!(
				actionEvent('set_stream_settings', defaults),
				new MockContext('action', signal),
			)
		}

		test('copies a preset service, its server and key from OBS', async () => {
			const learned = await learn({
				streamServiceType: 'rtmp_common',
				streamServiceSettings: {
					service: 'YouTube - RTMPS',
					server: 'rtmps://a.rtmps.youtube.com:443/live2',
					key: 'abc',
				},
			})
			expect(learned).toEqual({
				streamType: 'rtmp_common',
				service: 'YouTube - RTMPS',
				server: 'rtmps://a.rtmps.youtube.com:443/live2',
				streamKey: 'abc',
			})
		})

		test('copies custom RTMP settings including authentication', async () => {
			const learned = await learn({
				streamServiceType: 'rtmp_custom',
				streamServiceSettings: {
					server: 'rtmp://example/live',
					key: 'k',
					use_auth: true,
					username: 'u',
					password: 'p',
				},
			})
			expect(learned).toEqual({
				streamType: 'rtmp_custom',
				streamURL: 'rtmp://example/live',
				streamKey: 'k',
				useAuth: true,
				username: 'u',
				password: 'p',
			})
		})

		test('copies custom WHIP settings', async () => {
			const learned = await learn({
				streamServiceType: 'whip_custom',
				streamServiceSettings: { server: 'https://example/whip', service: 'WHIP', bearer_token: 't' },
			})
			expect(learned).toEqual({ streamType: 'whip_custom', streamURL: 'https://example/whip', bearerToken: 't' })
		})

		test('fills missing settings with empty strings', async () => {
			const learned = await learn({ streamServiceType: 'rtmp_common', streamServiceSettings: { service: 'Twitch' } })
			expect(learned).toEqual({ streamType: 'rtmp_common', service: 'Twitch', server: '', streamKey: '' })
		})

		test('learns nothing for a service type the action cannot represent', async () => {
			expect(await learn({ streamServiceType: 'some_plugin_service', streamServiceSettings: {} })).toBeUndefined()
		})

		test('learns nothing once the learn has been cancelled', async () => {
			const controller = new AbortController()
			controller.abort()
			const learned = await learn(
				{ streamServiceType: 'rtmp_common', streamServiceSettings: { service: 'Twitch' } },
				controller.signal,
			)
			expect(learned).toBeUndefined()
		})
	})
})
