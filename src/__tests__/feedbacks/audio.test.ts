import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { getAudioFeedbacks } from '../../feedbacks/audio.js'
import { ObsAudioMonitorType } from '../../types.js'
import { makeMockInstance, seedSource, type MockInstance } from '../mock/instance.js'
import { feedbackEvent } from '../mock/events.js'
import { MockContext } from '../mock-context.js'
import { looseFeedbacks } from '../loose-definitions.js'

describe('audio_track', () => {
	let self: MockInstance

	const check = (options: { source: string; track: string }): unknown => {
		const feedbacks = looseFeedbacks(getAudioFeedbacks(self))
		return feedbacks['audio_track'].callback(feedbackEvent('audio_track', options), new MockContext())
	}

	beforeEach(() => {
		self = makeMockInstance()
		seedSource(self, 'Mic')
		self.states.sources.get('Mic')!.inputAudioTracks = { '1': true, '2': false }
	})

	test('is true for an enabled track', () => {
		expect(check({ source: 'Mic', track: '1' })).toBe(true)
	})

	test('is false for a disabled track', () => {
		expect(check({ source: 'Mic', track: '2' })).toBe(false)
	})

	test('is false for a track the source does not report', () => {
		expect(check({ source: 'Mic', track: '4' })).toBe(false)
	})

	test('is false for an unknown source', () => {
		expect(check({ source: 'Nope', track: '1' })).toBe(false)
	})
})

describe('audio_monitor_type', () => {
	let self: MockInstance

	const check = (options: { source: string }): unknown => {
		const feedbacks = looseFeedbacks(getAudioFeedbacks(self))
		return feedbacks['audio_monitor_type'].callback(feedbackEvent('audio_monitor_type', options), new MockContext())
	}

	beforeEach(() => {
		self = makeMockInstance()
		seedSource(self, 'Mic')
	})

	test.each([ObsAudioMonitorType.MonitorOnly, ObsAudioMonitorType.MonitorAndOutput])(
		'is true for %s',
		(monitorType) => {
			self.states.sources.get('Mic')!.monitorType = monitorType

			expect(check({ source: 'Mic' })).toBe(true)
		},
	)

	test('is false when monitoring is off', () => {
		self.states.sources.get('Mic')!.monitorType = ObsAudioMonitorType.None

		expect(check({ source: 'Mic' })).toBe(false)
	})

	test('is false for an unknown source', () => {
		expect(check({ source: 'Nope' })).toBe(false)
	})
})

describe('sourceVolume', () => {
	let self: MockInstance

	const check = (source: string): unknown => {
		const feedbacks = looseFeedbacks(getAudioFeedbacks(self))
		return feedbacks['sourceVolume'].callback(feedbackEvent('sourceVolume', { source }), new MockContext())
	}

	beforeEach(() => {
		self = makeMockInstance()
		seedSource(self, 'Mic')
	})

	test('reports the current volume in dB', () => {
		self.states.sources.get('Mic')!.inputVolume = -12
		expect(check('Mic')).toBe(-12)
	})

	test('falls back to silence for a source with no reported volume', () => {
		expect(check('Mic')).toBe(-100)
	})

	test('falls back to silence for an unknown source', () => {
		expect(check('Nope')).toBe(-100)
	})
})

describe('audioPeaking', () => {
	let self: MockInstance

	const check = (options: { threshold: number; peakHold: number }): unknown => {
		const feedbacks = looseFeedbacks(getAudioFeedbacks(self))
		return feedbacks['audioPeaking'].callback(
			feedbackEvent('audioPeaking', { source: 'Mic', ...options }),
			new MockContext(),
		)
	}

	const setPeak = (peak: number): void => {
		self.states.sources.get('Mic')!.peak = peak
	}

	beforeEach(() => {
		vi.useFakeTimers()
		self = makeMockInstance()
		seedSource(self, 'Mic')
	})

	afterEach(() => {
		self.obs.clearAllPeakHolds()
		vi.useRealTimers()
	})

	test('follows the level directly with no hold', () => {
		setPeak(-10)
		expect(check({ threshold: -20, peakHold: 0 })).toBe(true)

		setPeak(-30)
		expect(check({ threshold: -20, peakHold: 0 })).toBe(false)
	})

	test('stays active for the hold duration after the level drops', () => {
		setPeak(-10)
		expect(check({ threshold: -20, peakHold: 1000 })).toBe(true)

		setPeak(-30)
		vi.advanceTimersByTime(999)
		expect(check({ threshold: -20, peakHold: 1000 })).toBe(true)

		vi.advanceTimersByTime(2)
		expect(check({ threshold: -20, peakHold: 1000 })).toBe(false)
	})

	test('re-checks the feedback when the hold expires', () => {
		setPeak(-10)
		check({ threshold: -20, peakHold: 1000 })

		vi.advanceTimersByTime(1000)

		expect(self.checkFeedbacksById).toHaveBeenCalledWith('test')
	})

	test('a further peak restarts the hold', () => {
		setPeak(-10)
		check({ threshold: -20, peakHold: 1000 })

		vi.advanceTimersByTime(900)
		// Still peaking, so the window starts over rather than expiring at 1000ms.
		check({ threshold: -20, peakHold: 1000 })

		setPeak(-30)
		vi.advanceTimersByTime(900)
		expect(check({ threshold: -20, peakHold: 1000 })).toBe(true)

		vi.advanceTimersByTime(200)
		expect(check({ threshold: -20, peakHold: 1000 })).toBe(false)
	})

	test('dropping the hold to 0 releases an active hold immediately', () => {
		setPeak(-10)
		check({ threshold: -20, peakHold: 1000 })

		setPeak(-30)
		expect(check({ threshold: -20, peakHold: 0 })).toBe(false)
	})

	test('losing the feedback clears its hold', () => {
		setPeak(-10)
		check({ threshold: -20, peakHold: 1000 })

		self.obs.removeMeterSubscriber('test')

		setPeak(-30)
		expect(check({ threshold: -20, peakHold: 1000 })).toBe(false)
	})
})
