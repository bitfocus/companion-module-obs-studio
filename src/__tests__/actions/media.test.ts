import { beforeEach, describe, expect, test } from 'vitest'
import { getMediaActions, resolveMediaTargets } from '../../actions/media.js'
import { OBSMediaStatus } from '../../types.js'
import { makeMockInstance, seedSource, type MockInstance } from '../mock/instance.js'
import { actionEvent } from '../mock/events.js'
import { MockContext } from '../mock-context.js'
import { looseActions } from '../loose-definitions.js'

describe('media_time', () => {
	let self: MockInstance

	const scrub = async (amount: number) => {
		const actions = looseActions(getMediaActions(self))
		await actions['media_time'].callback(
			actionEvent('media_time', { target: 'source', source: 'Clip', mode: 'adjust', value: 0, amount }),
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
			actionEvent('media_time', { target: 'source', source: 'Clip', mode: 'set', value: 5000, amount: 0 }),
			new MockContext(),
		)
		expect(self.socket.call).toHaveBeenCalledWith('SetMediaInputCursor', { inputName: 'Clip', mediaCursor: 5000 })
	})
})

describe('resolveMediaTargets', () => {
	let self: MockInstance

	/** Seeds a media source with a playback state, program activity, and when it started. */
	const seedClip = (
		name: string,
		state: { status?: OBSMediaStatus; active?: boolean; startedAt?: number } = {},
	): void => {
		seedSource(self, name, name, 'ffmpeg_source')
		const source = self.states.sources.get(name)!
		source.OBSMediaStatus = state.status ?? OBSMediaStatus.Playing
		source.active = state.active ?? true
		source.mediaStartedAt = state.startedAt
	}

	beforeEach(() => {
		self = makeMockInstance()
	})

	test('a specific source resolves to itself, whatever it is doing', () => {
		expect(resolveMediaTargets(self, { target: 'source', source: 'Anything' })).toEqual(['Anything'])
	})

	test('newest picks the clip that started most recently', () => {
		seedClip('First', { startedAt: 1000 })
		seedClip('Second', { startedAt: 2000 })

		expect(resolveMediaTargets(self, { target: 'newest', source: '' })).toEqual(['Second'])
	})

	test('a paused clip stays in the set and keeps its place', () => {
		seedClip('First', { startedAt: 1000 })
		seedClip('Second', { status: OBSMediaStatus.Paused, startedAt: 2000 })

		expect(resolveMediaTargets(self, { target: 'newest', source: '' })).toEqual(['Second'])
		expect(resolveMediaTargets(self, { target: 'all', source: '' })).toEqual(['First', 'Second'])
	})

	test('stopped clips are excluded', () => {
		seedClip('Playing', { startedAt: 1000 })
		seedClip('Stopped', { status: OBSMediaStatus.Stopped, startedAt: 2000 })

		expect(resolveMediaTargets(self, { target: 'all', source: '' })).toEqual(['Playing'])
		expect(resolveMediaTargets(self, { target: 'newest', source: '' })).toEqual(['Playing'])
	})

	test('clips that are not on program are excluded', () => {
		seedClip('OnProgram', { startedAt: 1000 })
		seedClip('OffProgram', { active: false, startedAt: 2000 })

		expect(resolveMediaTargets(self, { target: 'all', source: '' })).toEqual(['OnProgram'])
	})

	test('resolves to nothing when no clip is rolling', () => {
		expect(resolveMediaTargets(self, { target: 'newest', source: '' })).toEqual([])
		expect(resolveMediaTargets(self, { target: 'all', source: '' })).toEqual([])
	})

	test('an empty target sends no request at all, rather than acting on an empty name', async () => {
		const actions = looseActions(getMediaActions(self))
		await actions['media_control'].callback(
			actionEvent('media_control', { target: 'newest', source: '', action: 'toggle' }),
			new MockContext(),
		)

		expect(self.socket.call).not.toHaveBeenCalled()
		expect(self.socket.callBatch).not.toHaveBeenCalled()
	})

	test('several targets go out as one batch', async () => {
		seedClip('First', { startedAt: 1000 })
		seedClip('Second', { startedAt: 2000 })
		const actions = looseActions(getMediaActions(self))

		await actions['media_control'].callback(
			actionEvent('media_control', { target: 'all', source: '', action: 'stop' }),
			new MockContext(),
		)

		expect(self.socket.callBatch).toHaveBeenCalledTimes(1)
		expect(self.socket.callBatch.mock.calls[0][0]).toEqual([
			{ requestType: 'TriggerMediaInputAction', requestData: expect.objectContaining({ inputName: 'First' }) },
			{ requestType: 'TriggerMediaInputAction', requestData: expect.objectContaining({ inputName: 'Second' }) },
		])
	})
})
