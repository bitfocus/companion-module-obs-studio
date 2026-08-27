import { beforeEach, describe, expect, test } from 'vitest'
import { VariablePublisher } from '../variables.js'

describe('VariablePublisher', () => {
	let publisher: VariablePublisher

	beforeEach(() => {
		publisher = new VariablePublisher()
	})

	test('passes everything through on the first publish', () => {
		expect(publisher.publishVariables({ fps: 30, cpu_usage: 3.5 })).toEqual({ fps: 30, cpu_usage: 3.5 })
	})

	test('suppresses a republish of identical values', () => {
		publisher.publishVariables({ fps: 30, cpu_usage: 3.5 })

		expect(publisher.publishVariables({ fps: 30, cpu_usage: 3.5 })).toBeUndefined()
	})

	test('publishes only the keys that moved', () => {
		publisher.publishVariables({ fps: 30, cpu_usage: 3.5, memory_usage: 900 })

		expect(publisher.publishVariables({ fps: 30, cpu_usage: 4.1, memory_usage: 900 })).toEqual({ cpu_usage: 4.1 })
	})

	test('treats a value returning to a previous one as a change', () => {
		publisher.publishVariables({ recording: 'Recording' })
		publisher.publishVariables({ recording: 'Stopped' })

		expect(publisher.publishVariables({ recording: 'Recording' })).toEqual({ recording: 'Recording' })
	})

	test('compares array values element-wise rather than by identity', () => {
		publisher.publishVariables({ current_media_name: ['Clip A', 'Clip B'] })

		// A fresh array with the same contents is not a change...
		expect(publisher.publishVariables({ current_media_name: ['Clip A', 'Clip B'] })).toBeUndefined()
		// ...but different contents are.
		expect(publisher.publishVariables({ current_media_name: ['Clip A'] })).toEqual({ current_media_name: ['Clip A'] })
	})

	test('distinguishes an empty array from a previously populated one', () => {
		publisher.publishVariables({ current_media_name: ['Clip A'] })

		expect(publisher.publishVariables({ current_media_name: [] })).toEqual({ current_media_name: [] })
	})

	test('publishes a value set to undefined, then suppresses the repeat', () => {
		publisher.publishVariables({ media_status_Clip: 'Playing' })

		expect(publisher.publishVariables({ media_status_Clip: undefined })).toEqual({ media_status_Clip: undefined })
		expect(publisher.publishVariables({ media_status_Clip: undefined })).toBeUndefined()
	})

	test('republishes in full after a reset', () => {
		publisher.publishVariables({ fps: 30, cpu_usage: 3.5 })
		expect(publisher.publishVariables({ fps: 30, cpu_usage: 3.5 })).toBeUndefined()

		// What a definition rebuild does: the host no longer holds these values.
		publisher.reset()

		expect(publisher.publishVariables({ fps: 30, cpu_usage: 3.5 })).toEqual({ fps: 30, cpu_usage: 3.5 })
	})
})
