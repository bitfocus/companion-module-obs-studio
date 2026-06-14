import { describe, expect, test } from 'vitest'
import {
	clamp,
	validName,
	formatTimecode,
	roundNumber,
	rgbaToObsColor,
	obsColorToRgba,
	getOBSRecordingStateLabel,
	getOBSStreamingStateLabel,
	getOBSMediaStatusLabel,
	getMonitorTypeLabel,
} from './utils.js'
import { OBSRecordingState, OBSStreamingState, OBSMediaStatus, ObsAudioMonitorType } from './types.js'

describe('clamp', () => {
	test('returns the value when within range', () => {
		expect(clamp(5, 0, 10)).toBe(5)
	})
	test('clamps to the minimum', () => {
		expect(clamp(-5, 0, 10)).toBe(0)
	})
	test('clamps to the maximum', () => {
		expect(clamp(15, 0, 10)).toBe(10)
	})
})

describe('validName', () => {
	test('passes through valid characters', () => {
		expect(validName('scene-1_test.2')).toBe('scene-1_test.2')
	})
	test('replaces invalid characters with underscores', () => {
		expect(validName('My Scene!')).toBe('My_Scene_')
	})
	test('collapses runs of invalid characters into a single underscore', () => {
		expect(validName('a   b')).toBe('a_b')
	})
})

describe('formatTimecode', () => {
	test('formats zero', () => {
		expect(formatTimecode(0)).toBe('00:00:00')
	})
	test('formats seconds and minutes', () => {
		expect(formatTimecode(90_000)).toBe('00:01:30')
	})
	test('formats hours', () => {
		expect(formatTimecode(3_661_000)).toBe('01:01:01')
	})
})

describe('roundNumber', () => {
	test('rounds to the given decimal places', () => {
		expect(roundNumber(1.23456, 2)).toBe(1.23)
	})
	test('rounds to an integer when given zero places', () => {
		expect(roundNumber(1.6, 0)).toBe(2)
	})
	test('defaults to zero decimal places when not specified', () => {
		// @ts-expect-error exercising the `decimalPlaces ?? 0` fallback path
		expect(roundNumber(1.6)).toBe(2)
	})
})

describe('color conversion', () => {
	test('round-trips rgba through the OBS integer format', () => {
		const original = 'rgba(18, 52, 86, 1)'
		expect(obsColorToRgba(rgbaToObsColor(original))).toBe(original)
	})
	test('parses a fractional alpha', () => {
		const obs = rgbaToObsColor('rgba(255, 0, 0, 0.5)')
		expect(obsColorToRgba(obs)).toBe('rgba(255, 0, 0, 0.5019607843137255)')
	})
	test('returns 0 for an unparseable color string', () => {
		expect(rgbaToObsColor('not a color')).toBe(0)
	})
})

describe('state label helpers', () => {
	test('recording labels', () => {
		expect(getOBSRecordingStateLabel(OBSRecordingState.Recording)).toBe('Recording')
		expect(getOBSRecordingStateLabel(OBSRecordingState.Paused)).toBe('Paused')
		expect(getOBSRecordingStateLabel('unexpected' as OBSRecordingState)).toBe('Unknown')
	})
	test('streaming labels', () => {
		expect(getOBSStreamingStateLabel(OBSStreamingState.Streaming)).toBe('Live')
		expect(getOBSStreamingStateLabel(OBSStreamingState.OffAir)).toBe('Off-Air')
	})
	test('media status labels', () => {
		expect(getOBSMediaStatusLabel(OBSMediaStatus.Playing)).toBe('Playing')
		expect(getOBSMediaStatusLabel(undefined)).toBe('Stopped')
	})
	test('monitor type labels', () => {
		expect(getMonitorTypeLabel(ObsAudioMonitorType.MonitorAndOutput)).toBe('Monitor / Output')
		expect(getMonitorTypeLabel(ObsAudioMonitorType.MonitorOnly)).toBe('Monitor Only')
		expect(getMonitorTypeLabel(undefined)).toBe('Off')
	})
})
