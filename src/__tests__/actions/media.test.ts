import { beforeEach, describe, expect, test } from 'vitest'
import { getMediaActions } from '../../actions/media.js'
import { makeMockInstance, seedSource, type MockInstance } from '../mock/instance.js'
import { actionEvent } from '../mock/events.js'
import { MockContext } from '../mock-context.js'
import { looseActions } from '../loose-definitions.js'

describe('media_time', () => {
	let self: MockInstance

	const scrub = async (amount: number) => {
		const actions = looseActions(getMediaActions(self))
		await actions['media_time'].callback(
			actionEvent('media_time', { useCurrentMedia: false, source: 'Clip', mode: 'adjust', value: 0, amount }),
			new MockContext(),
		)
	}

	beforeEach(() => {
		self = makeMockInstance()
		seedSource(self, 'Clip', 'Clip', 'ffmpeg_source')
	})

	// Scrubbing is symmetric: both directions send the same request with an opposite sign. Asserted in
	// both directions because a rotary reported forward scrubs as not moving, and the cause was not here.
	test('scrubs forward by the amount, in milliseconds', async () => {
		await scrub(1)
		expect(self.socket.call).toHaveBeenCalledWith('OffsetMediaInputCursor', {
			inputName: 'Clip',
			mediaCursorOffset: 1000,
		})
	})

	test('scrubs backward by the amount, in milliseconds', async () => {
		await scrub(-1)
		expect(self.socket.call).toHaveBeenCalledWith('OffsetMediaInputCursor', {
			inputName: 'Clip',
			mediaCursorOffset: -1000,
		})
	})

	test('sets an absolute cursor position', async () => {
		const actions = looseActions(getMediaActions(self))
		await actions['media_time'].callback(
			actionEvent('media_time', { useCurrentMedia: false, source: 'Clip', mode: 'set', value: 5000, amount: 0 }),
			new MockContext(),
		)
		expect(self.socket.call).toHaveBeenCalledWith('SetMediaInputCursor', { inputName: 'Clip', mediaCursor: 5000 })
	})
})
