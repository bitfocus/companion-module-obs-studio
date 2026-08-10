import type {
	CompanionActionCallbackContext,
	CompanionFeedbackCallbackContext,
	CompanionLearnCallbackContext,
	CompanionVariableValue,
} from '@companion-module/base'

// https://github.com/bitfocus/companion/blob/bfe2e89d2fdbddf0d2347e73305e866c659ae412/companion/lib/Variables/Util.ts#L22
const VARIABLE_REGEX = /\$\(([^:$)]+):([^)$]+)\)/

/** Mock Companion context for action/feedback variable resolution in tests. */
export class MockContext
	implements CompanionActionCallbackContext, CompanionFeedbackCallbackContext, CompanionLearnCallbackContext
{
	readonly type: 'action' | 'feedback'
	readonly signal: AbortSignal

	#variables = new Map<string, string>()
	#customVariables = new Map<string, CompanionVariableValue>()

	constructor(type: 'action' | 'feedback' = 'action', signal: AbortSignal = new AbortController().signal) {
		this.type = type
		this.signal = signal
	}

	getVariable(name: string): string {
		return this.#variables.get(name) ?? '$NA'
	}

	setVariable(name: string, value: string): void {
		this.#variables.set(name, value)
	}

	clearVariables(): void {
		this.#variables.clear()
	}

	setCustomVariableValue(variableName: string, value: CompanionVariableValue): void {
		this.#customVariables.set(variableName, value)
	}

	async parseVariablesInString(text: string): Promise<string> {
		return new Promise<string>((resolve) => {
			let result = text

			let match: RegExpExecArray | null
			while ((match = VARIABLE_REGEX.exec(result)) !== null) {
				const [fullId, module, varname] = match
				result = result.replace(fullId, () => this.getVariable(`${module}:${varname}`))
			}

			resolve(result)
		})
	}
}
