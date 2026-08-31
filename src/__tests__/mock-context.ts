import type {
	CompanionActionCallbackContext,
	CompanionFeedbackCallbackContext,
	CompanionLearnCallbackContext,
	CompanionVariableValue,
} from '@companion-module/base'

/**
 * Mock Companion context for action/feedback callbacks.
 *
 * Under API 2.0 Companion resolves option expressions before invoking a callback, so the module
 * never calls back into the context. The methods exist only to satisfy the three interfaces; giving
 * them real implementations would be untested code that reads like a working fixture.
 */
export class MockContext
	implements CompanionActionCallbackContext, CompanionFeedbackCallbackContext, CompanionLearnCallbackContext
{
	readonly type: 'action' | 'feedback'
	readonly signal: AbortSignal

	constructor(type: 'action' | 'feedback' = 'action', signal: AbortSignal = new AbortController().signal) {
		this.type = type
		this.signal = signal
	}

	getVariable(_name: string): string {
		throw new Error('MockContext.getVariable is not implemented — no module code calls it')
	}

	setCustomVariableValue(_variableName: string, _value: CompanionVariableValue): void {
		throw new Error('MockContext.setCustomVariableValue is not implemented — no module code calls it')
	}

	async parseVariablesInString(_text: string): Promise<string> {
		throw new Error('MockContext.parseVariablesInString is not implemented — no module code calls it')
	}
}
