import { beforeEach, describe, expect, test } from 'vitest'
import { VariablePublisher } from '../variable-publisher.js'

describe('VariablePublisher', () => {
	let publisher: VariablePublisher

	beforeEach(() => {
		publisher = new VariablePublisher()
	})

	test('passes everything through on the first publish', () => {
		expect(publisher.filterChanged({ fps: 30, cpu_usage: 3.5 })).toEqual({ fps: 30, cpu_usage: 3.5 })
	})

	test('suppresses a republish of identical values', () => {
		publisher.filterChanged({ fps: 30, cpu_usage: 3.5 })

		expect(publisher.filterChanged({ fps: 30, cpu_usage: 3.5 })).toBeUndefined()
	})

	test('publishes only the keys that moved', () => {
		publisher.filterChanged({ fps: 30, cpu_usage: 3.5, memory_usage: 900 })

		expect(publisher.filterChanged({ fps: 30, cpu_usage: 4.1, memory_usage: 900 })).toEqual({ cpu_usage: 4.1 })
	})

	test('treats a value returning to a previous one as a change', () => {
		publisher.filterChanged({ recording: 'Recording' })
		publisher.filterChanged({ recording: 'Stopped' })

		expect(publisher.filterChanged({ recording: 'Recording' })).toEqual({ recording: 'Recording' })
	})

	test('compares array values element-wise rather than by identity', () => {
		publisher.filterChanged({ current_media_name: ['Clip A', 'Clip B'] })

		// A fresh array with the same contents is not a change...
		expect(publisher.filterChanged({ current_media_name: ['Clip A', 'Clip B'] })).toBeUndefined()
		// ...but different contents are.
		expect(publisher.filterChanged({ current_media_name: ['Clip A'] })).toEqual({ current_media_name: ['Clip A'] })
	})

	test('distinguishes an empty array from a previously populated one', () => {
		publisher.filterChanged({ current_media_name: ['Clip A'] })

		expect(publisher.filterChanged({ current_media_name: [] })).toEqual({ current_media_name: [] })
	})

	test('publishes a value set to undefined, then suppresses the repeat', () => {
		publisher.filterChanged({ media_status_Clip: 'Playing' })

		expect(publisher.filterChanged({ media_status_Clip: undefined })).toEqual({ media_status_Clip: undefined })
		expect(publisher.filterChanged({ media_status_Clip: undefined })).toBeUndefined()
	})

	test('republishes in full after a reset', () => {
		publisher.filterChanged({ fps: 30, cpu_usage: 3.5 })
		expect(publisher.filterChanged({ fps: 30, cpu_usage: 3.5 })).toBeUndefined()

		// What a definition rebuild does: the host no longer holds these values.
		publisher.reset()

		expect(publisher.filterChanged({ fps: 30, cpu_usage: 3.5 })).toEqual({ fps: 30, cpu_usage: 3.5 })
	})
})
