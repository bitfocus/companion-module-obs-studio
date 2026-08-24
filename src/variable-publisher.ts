import type { CompanionVariableValues } from '@companion-module/base'

type VariableValue = CompanionVariableValues[string]

export class VariablePublisher {
	private lastPublished = new Map<string, VariableValue>()

	/**
	 * Returns only the entries that differ from the last publish, or `undefined` when none do.
	 * Recording them here assumes the caller then publishes what it was handed.
	 */
	public filterChanged(values: CompanionVariableValues): CompanionVariableValues | undefined {
		let changed: CompanionVariableValues | undefined
		for (const key of Object.keys(values)) {
			const value = values[key]
			if (this.lastPublished.has(key) && isSameValue(this.lastPublished.get(key), value)) continue
			this.lastPublished.set(key, value)
			changed ??= {}
			changed[key] = value
		}
		return changed
	}

	/**
	 * Forgets everything published so far, so the next write republishes in full.
	 *
	 * Called whenever the variable definitions are rebuilt: the host drops values for definitions it
	 * no longer has, so a suppressed write after a rebuild would leave a variable permanently blank.
	 */
	public reset(): void {
		this.lastPublished.clear()
	}
}

/** Variable values are primitives or flat string arrays; arrays are compared element-wise. */
function isSameValue(a: VariableValue, b: VariableValue): boolean {
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
		return a.every((entry, index) => entry === b[index])
	}
	return a === b
}
