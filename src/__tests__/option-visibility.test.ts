import { describe, expect, test } from 'vitest'
import { getActions } from '../actions.js'
import { getFeedbacks } from '../feedbacks.js'
import { makeMockInstance, seedFullState } from './mock/instance.js'
import { looseActions, looseFeedbacks } from './loose-definitions.js'

interface LooseOption {
	id: string
	type: string
	isVisibleExpression?: string
	disableAutoExpression?: boolean
}

/**
 * `isVisibleExpression` may only reference fields carrying `disableAutoExpression`.
 *
 * Any other field can be switched into expression mode by the user, and its value then changes as
 * expressions re-evaluate — which would hide and show inputs underneath the user, potentially
 * leaving a required field unreachable. The rule is an API 2.0 addition and is not enforced by the
 * types, so it is checked here.
 */
function visibilityViolations(definitions: Record<string, { options?: unknown[] }>, kind: string): string[] {
	const problems: string[] = []
	for (const definitionId of Object.keys(definitions)) {
		const options = (definitions[definitionId].options ?? []) as LooseOption[]
		const byId = new Map(options.map((option) => [option.id, option]))
		for (const option of options) {
			if (typeof option.isVisibleExpression !== 'string') continue
			const referenced = [...option.isVisibleExpression.matchAll(/\$\(options:([A-Za-z0-9_]+)\)/g)].map((m) => m[1])
			expect(
				referenced.length,
				`${kind} ${definitionId}: '${option.id}' has an expression referencing no field`,
			).toBeGreaterThan(0)
			for (const ref of referenced) {
				const target = byId.get(ref)
				if (!target) {
					problems.push(`${kind} ${definitionId}: '${option.id}' references unknown field '${ref}'`)
				} else if (target.disableAutoExpression !== true) {
					problems.push(`${kind} ${definitionId}: '${option.id}' references '${ref}' which lacks disableAutoExpression`)
				}
			}
		}
	}
	return problems
}

describe('isVisibleExpression references', () => {
	const self = makeMockInstance()
	seedFullState(self)

	test('every action visibility expression references a non-expression field', () => {
		expect(visibilityViolations(looseActions(getActions.call(self)), 'action')).toEqual([])
	})

	test('every feedback visibility expression references a non-expression field', () => {
		expect(visibilityViolations(looseFeedbacks(getFeedbacks.call(self)), 'feedback')).toEqual([])
	})
})
