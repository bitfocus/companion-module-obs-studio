import type { CompanionInputFieldDropdown, CompanionInputFieldNumber, DropdownChoice } from '@companion-module/base'
import { clamp } from '../utils.js'

/**
 * Several action families take a leading dropdown that chooses between assigning a value and
 * offsetting the current one, with the value and amount fields shown for the matching mode.
 */
export type SetAdjustMode = 'set' | 'adjust'

/** The expression that shows an option only while the mode dropdown is on `mode`. */
export function visibleWhenMode(mode: string): string {
	return `$(options:mode) === '${mode}'`
}

export function modeDropdown(
	choices: DropdownChoice[] = [
		{ id: 'set', label: 'Set' },
		{ id: 'adjust', label: 'Adjust' },
	],
): CompanionInputFieldDropdown<'mode'> {
	return {
		type: 'dropdown',
		disableAutoExpression: true,
		label: 'Mode',
		id: 'mode',
		default: 'set',
		choices,
	}
}

type ModeNumberField<TKey extends string> = Omit<
	CompanionInputFieldNumber<TKey>,
	'type' | 'clampValues' | 'isVisibleExpression'
>

/** A clamped number field that is only visible while the mode dropdown is on `mode`. */
export function modeNumber<TKey extends string>(
	mode: string,
	field: ModeNumberField<TKey>,
): CompanionInputFieldNumber<TKey> {
	return {
		...field,
		type: 'number',
		clampValues: true,
		isVisibleExpression: visibleWhenMode(mode),
	}
}

/**
 * Resolves a set/adjust pair against the current value. Returns undefined when an adjustment has
 * no current value to work from, so the caller can report that rather than guessing a baseline.
 */
export function resolveSetAdjust(
	options: { mode: SetAdjustMode; value: number; amount: number },
	current: number,
	min: number,
	max: number,
): number
export function resolveSetAdjust(
	options: { mode: SetAdjustMode; value: number; amount: number },
	current: number | undefined,
	min: number,
	max: number,
): number | undefined
export function resolveSetAdjust(
	options: { mode: SetAdjustMode; value: number; amount: number },
	current: number | undefined,
	min: number,
	max: number,
): number | undefined {
	if (options.mode === 'set') return options.value
	if (current === undefined) return undefined
	return clamp(current + options.amount, min, max)
}
