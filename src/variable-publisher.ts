import type { CompanionVariableValue, CompanionVariableValues } from '@companion-module/base'

/**
 * Drops variable writes whose value has not changed since the last publish.
 *
 * The host already ignores unchanged values, so this is not what stops dependents re-evaluating. It
 * compares with `!==` though, which is identity for arrays: values rebuilt each tick
 * (`current_media_name` and friends) look changed to it every time, and only an element-wise
 * comparison here catches that.
 */
export class VariablePublisher {
	private lastPublished = new Map<string, CompanionVariableValue>()

	/** Returns the changed entries and records them as published, so the caller must publish them. */
	public takeChanged(values: CompanionVariableValues): CompanionVariableValues | undefined {
		let changed: CompanionVariableValues | undefined
		for (const key of Object.keys(values)) {
			const value = values[key]
			// `has` before `get`, so a stored `undefined` differs from "never published".
			if (this.lastPublished.has(key) && isSameValue(this.lastPublished.get(key), value)) continue
			this.lastPublished.set(key, value)
			changed ??= {}
			changed[key] = value
		}
		return changed
	}

	/**
	 * Republishes in full on the next write. Called wherever the host may no longer hold these values;
	 * a redundant republish costs nothing, a missed one leaves a variable blank with no error.
	 */
	public reset(): void {
		this.lastPublished.clear()
	}
}

/** Values are primitives or flat arrays. */
function isSameValue(a: CompanionVariableValue, b: CompanionVariableValue): boolean {
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((entry, index) => entry === b[index])
	}
	if (Array.isArray(a) || Array.isArray(b)) return false
	return a === b
}
