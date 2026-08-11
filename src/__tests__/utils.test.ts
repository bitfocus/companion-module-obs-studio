import { describe, expect, test } from 'vitest'
import {
	clamp,
	validName,
	formatTimecode,
	splitTimecode,
	roundNumber,
	rgbaToObsColor,
	obsColorToRgba,
	getOBSRecordingStateLabel,
	getOBSStreamingStateLabel,
	getOBSMediaStatusLabel,
	getMonitorTypeLabel,
	describeError,
	asString,
	asNumber,
	extractFileName,
	readTextSourceValue,
	readMediaFileName,
} from '../utils.js'
import { OBSRecordingState, OBSStreamingState, OBSMediaStatus, ObsAudioMonitorType } from '../types.js'

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

describe('splitTimecode', () => {
	test('splits a full timecode into parts', () => {
		expect(splitTimecode('01:23:45')).toEqual({ hh: '01', mm: '23', ss: '45' })
	})
	test('defaults missing parts to 00', () => {
		expect(splitTimecode('12')).toEqual({ hh: '12', mm: '00', ss: '00' })
		expect(splitTimecode('')).toEqual({ hh: '', mm: '00', ss: '00' })
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
		expect(getOBSStreamingStateLabel(OBSStreamingState.Reconnecting)).toBe('Reconnecting')
		expect(getOBSStreamingStateLabel(OBSStreamingState.Reconnected)).toBe('Live')
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

describe('describeError', () => {
	test('uses the message of an Error', () => {
		expect(describeError(new Error('boom'))).toBe('boom')
	})
	test('uses the message property of a plain rejection object', () => {
		expect(describeError({ message: 'not connected' })).toBe('not connected')
	})
	test('stringifies values with no message', () => {
		expect(describeError('plain string')).toBe('plain string')
		expect(describeError(undefined)).toBe('undefined')
	})
})

describe('asString / asNumber', () => {
	test('passes through matching types', () => {
		expect(asString('hello')).toBe('hello')
		expect(asNumber(42)).toBe(42)
	})
	test('rejects mismatched types', () => {
		expect(asString(42)).toBeUndefined()
		expect(asNumber('42')).toBeUndefined()
		expect(asNumber(null)).toBeUndefined()
	})
	test('rejects non-finite numbers', () => {
		expect(asNumber(NaN)).toBeUndefined()
		expect(asNumber(Infinity)).toBeUndefined()
	})
})

describe('extractFileName', () => {
	test('strips posix directories and the extension', () => {
		expect(extractFileName('/home/user/videos/clip.mp4')).toBe('clip')
	})
	test('strips windows directories and the extension', () => {
		expect(extractFileName('C:\\Media\\intro.mov')).toBe('intro')
	})
	test('keeps a bare name with no extension', () => {
		expect(extractFileName('README')).toBe('README')
	})
	test('returns empty string for non-string input', () => {
		expect(extractFileName(undefined)).toBe('')
		expect(extractFileName(123)).toBe('')
	})
})

describe('readTextSourceValue', () => {
	test('reads inline text', () => {
		expect(readTextSourceValue({ text: 'Hello' })).toBe('Hello')
	})
	test('reports the file path when reading from file', () => {
		expect(readTextSourceValue({ from_file: true, text_file: '/tmp/a.txt' })).toBe('Text from file: /tmp/a.txt')
	})
	test('falls back to the `file` key for the FreeType renderer', () => {
		expect(readTextSourceValue({ read_from_file: true, file: '/tmp/b.txt' })).toBe('Text from file: /tmp/b.txt')
	})
	test('returns empty string when settings are missing or text is absent', () => {
		expect(readTextSourceValue(undefined)).toBe('')
		expect(readTextSourceValue({})).toBe('')
	})
})

describe('readMediaFileName', () => {
	test('reads the first playlist entry for VLC sources', () => {
		expect(readMediaFileName({ playlist: [{ value: '/media/one.mp4' }, { value: '/media/two.mp4' }] })).toBe('one')
	})
	test('reads local_file for ffmpeg sources', () => {
		expect(readMediaFileName({ local_file: '/media/show.mkv' })).toBe('show')
	})
	test('returns empty string for an empty playlist or missing settings', () => {
		expect(readMediaFileName({ playlist: [] })).toBe('')
		expect(readMediaFileName(undefined)).toBe('')
	})
})
