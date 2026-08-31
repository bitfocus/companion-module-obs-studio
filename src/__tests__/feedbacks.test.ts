import { beforeEach, describe, expect, test } from 'vitest'
import { getFeedbacks } from '../feedbacks.js'
import { makeMockInstance, seedFullState, type MockInstance } from './mock/instance.js'
import { defaultOptions, feedbackEvent } from './mock/events.js'
import { MockContext } from './mock-context.js'
import { looseFeedbacks, type LooseFeedbacks } from './loose-definitions.js'

/** Built once at collection time, since `test.each` needs the ids before `beforeEach` runs. */
const FEEDBACK_IDS = (() => {
	const self = makeMockInstance()
	seedFullState(self)
	return Object.keys(looseFeedbacks(getFeedbacks.call(self)))
})()

describe('feedbacks', () => {
	let self: MockInstance
	let feedbacks: LooseFeedbacks

	beforeEach(() => {
		self = makeMockInstance()
		seedFullState(self)
		feedbacks = looseFeedbacks(getFeedbacks.call(self))
	})

	test('produces a non-empty feedback set', () => {
		expect(FEEDBACK_IDS.length).toBeGreaterThan(0)
	})

	// `CompanionFeedbackDefinitions<OBSFeedbackSchemas>` statically enforces the rest of the shape,
	// including `defaultStyle` being required on boolean feedbacks.
	test('every feedback has a non-empty name', () => {
		const unnamed = FEEDBACK_IDS.filter((id) => feedbacks[id].name.length === 0)
		expect(unnamed).toEqual([])
	})

	// Feedback ids are plain strings at the `checkFeedbacks` call sites, so a renamed or mistyped id
	// silently becomes a no-op recheck. Catch that here rather than in the field.
	test('every id passed to checkFeedbacks exists', async () => {
		const { readFile, readdir } = await import('node:fs/promises')
		const { join } = await import('node:path')

		const sourceFiles: string[] = []
		const walk = async (dir: string): Promise<void> => {
			for (const entry of await readdir(dir, { withFileTypes: true })) {
				const path = join(dir, entry.name)
				if (entry.isDirectory()) {
					if (entry.name !== '__tests__' && entry.name !== 'node_modules') await walk(path)
				} else if (entry.name.endsWith('.ts')) {
					sourceFiles.push(path)
				}
			}
		}
		await walk(join(import.meta.dirname, '..'))

		const unknown: string[] = []
		for (const file of sourceFiles) {
			const contents = await readFile(file, 'utf8')
			for (const call of contents.matchAll(/checkFeedbacks\(([^)]*)\)/gs)) {
				for (const quoted of call[1].matchAll(/'([^']+)'/g)) {
					if (!FEEDBACK_IDS.includes(quoted[1])) unknown.push(`${file} -> ${quoted[1]}`)
				}
			}
		}
		expect(unknown).toEqual([])
	})

	describe('every feedback callback runs without throwing and returns a valid shape', () => {
		test.each(FEEDBACK_IDS)('%s', async (id) => {
			const def = feedbacks[id]
			const result = await Promise.resolve(def.callback(feedbackEvent(id, defaultOptions(def)), new MockContext()))
			const expectedType = def.type === 'boolean' ? 'boolean' : def.type === 'value' ? 'number' : 'object'
			expect(typeof result).toBe(expectedType)
		})
	})
})
