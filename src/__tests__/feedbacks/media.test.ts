import { beforeEach, describe, expect, test } from 'vitest'
import { getMediaFeedbacks } from '../../feedbacks/media.js'
import { makeMockInstance, seedSource, type MockInstance } from '../mock/instance.js'
import { feedbackEvent } from '../mock/events.js'
import { MockContext } from '../mock-context.js'
import { looseFeedbacks } from '../loose-definitions.js'

describe('media value feedbacks', () => {
	let self: MockInstance

	const check = (id: 'mediaProgress' | 'mediaTimeRemaining', source: string): unknown => {
		const feedbacks = looseFeedbacks(getMediaFeedbacks(self))
		return feedbacks[id].callback(feedbackEvent(id, { source }), new MockContext())
	}

	const seedMedia = (cursor: number, duration: number): void => {
		const source = self.states.sources.get('Clip')!
		source.mediaCursor = cursor
		source.mediaDuration = duration
	}

	beforeEach(() => {
		self = makeMockInstance()
		seedSource(self, 'Clip', 'Clip', 'ffmpeg_source')
	})

	describe('mediaProgress', () => {
		test('is 0 at the start of playback', () => {
			seedMedia(0, 10_000)
			expect(check('mediaProgress', 'Clip')).toBe(0)
		})

		test('is the percentage through the clip', () => {
			seedMedia(2500, 10_000)
			expect(check('mediaProgress', 'Clip')).toBe(25)
		})

		test('is 100 at the end of the clip', () => {
			seedMedia(10_000, 10_000)
			expect(check('mediaProgress', 'Clip')).toBe(100)
		})

		test('clamps a cursor past the end', () => {
			seedMedia(12_000, 10_000)
			expect(check('mediaProgress', 'Clip')).toBe(100)
		})

		test('is 0 when the duration is unknown', () => {
			expect(check('mediaProgress', 'Clip')).toBe(0)
		})

		test('is 0 for an unknown source', () => {
			expect(check('mediaProgress', 'Nope')).toBe(0)
		})
	})

	describe('mediaTimeRemaining', () => {
		test('reports the remaining seconds', () => {
			seedMedia(2500, 10_000)
			expect(check('mediaTimeRemaining', 'Clip')).toBe(8)
		})

		test('is floored at 0 once the cursor passes the duration', () => {
			seedMedia(12_000, 10_000)
			expect(check('mediaTimeRemaining', 'Clip')).toBe(0)
		})

		test('is 0 for an unknown source', () => {
			expect(check('mediaTimeRemaining', 'Nope')).toBe(0)
		})
	})
})
