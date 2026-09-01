import type {
	CompanionInputFieldDropdown,
	CompanionInputFieldMultiDropdown,
	CompanionInputFieldNumber,
	DropdownChoice,
} from '@companion-module/base'
import type OBSInstance from '../main.js'
import { clamp } from '../utils.js'
import { VIRTUALCAM_OUTPUT_NAME } from '../constants.js'

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

/** OBS exposes six mixer tracks; the action and feedback that target them share this list. */
export const AUDIO_TRACK_CHOICES: DropdownChoice[] = [1, 2, 3, 4, 5, 6].map((track) => ({
	id: String(track),
	label: `Track ${track}`,
}))

/**
 * The first entry of a choice list, for use as an option default. Lists are rebuilt from OBS state,
 * so they are routinely empty before the first connection completes.
 */
function firstChoiceId(choices: DropdownChoice[], fallback = ''): string {
	return choices[0] === undefined ? fallback : String(choices[0].id)
}

/**
 * The choice lists an option can be bound to, each paired with the default that belongs to it.
 *
 * Choices and default travel together deliberately. They were previously written out at each option,
 * which let a dropdown be given a default drawn from a different list than the one it offers — a
 * mismatch nothing would catch. Naming the list is now the only way to ask for either.
 */
interface ChoiceListSpec {
	choices: (self: OBSInstance) => DropdownChoice[]
	default: (self: OBSInstance) => string | number
}

const CHOICE_LISTS = {
	source: {
		choices: (self) => self.obsState.sourceChoices,
		default: (self) => self.obsState.sourceListDefault,
	},
	/** Sources and scenes together, for options that accept either (filters attach to both). */
	sourceWithScenes: {
		choices: (self) => self.obsState.sourceChoicesWithScenes,
		// The source list leads, so its first entry is the default even though scenes are appended.
		default: (self) => self.obsState.sourceListDefault,
	},
	scene: {
		choices: (self) => self.obsState.sceneChoices,
		default: (self) => self.obsState.sceneListDefault,
	},
	/** Only the sources that are groups, for options that target a group as a container. */
	group: {
		choices: (self) => self.obsState.groupChoices,
		default: (self) => self.obsState.groupChoicesDefault,
	},
	audioSource: {
		choices: (self) => self.obsState.audioSourceList,
		default: (self) => self.obsState.audioSourceListDefault,
	},
	mediaSource: {
		choices: (self) => self.obsState.mediaSourceList,
		default: (self) => self.obsState.mediaSourceListDefault,
	},
	textSource: {
		choices: (self) => self.obsState.textSourceList,
		default: (self) => firstChoiceId(self.obsState.textSourceList, 'None'),
	},
	filter: {
		choices: (self) => self.obsState.filterList,
		default: (self) => self.obsState.filterListDefault,
	},
	transition: {
		choices: (self) => self.obsState.transitionList,
		default: (self) => firstChoiceId(self.obsState.transitionList),
	},
	profile: {
		choices: (self) => self.obsState.profileChoices,
		default: (self) => self.obsState.profileChoicesDefault,
	},
	sceneCollection: {
		choices: (self) => self.obsState.sceneCollectionList,
		default: (self) => firstChoiceId(self.obsState.sceneCollectionList),
	},
	output: {
		choices: (self) => self.obsState.outputList,
		default: () => VIRTUALCAM_OUTPUT_NAME,
	},
	hotkey: {
		choices: (self) => self.states.hotkeyNames,
		default: (self) => firstChoiceId(self.states.hotkeyNames),
	},
	monitor: {
		choices: (self) => self.states.monitors,
		default: () => 0,
	},
	imageFormat: {
		choices: (self) => self.states.imageFormats,
		default: () => 'png',
	},
} as const satisfies Record<string, ChoiceListSpec>

export type ChoiceListName = keyof typeof CHOICE_LISTS

interface ChoiceDropdownField<TKey extends string> {
	id: TKey
	label: string
	/** Defaults to true: nearly every list is of user-named OBS entities, which expressions may target. */
	allowCustom?: boolean
	disableAutoExpression?: boolean
	isVisibleExpression?: string
	/** Overrides the list's own default; only for options that intentionally start elsewhere. */
	default?: string | number
}

/** A dropdown bound to one of the module's state-derived choice lists. */
export function choiceDropdown<TKey extends string>(
	self: OBSInstance,
	list: ChoiceListName,
	field: ChoiceDropdownField<TKey>,
): CompanionInputFieldDropdown<TKey> {
	const spec: ChoiceListSpec = CHOICE_LISTS[list]
	return {
		type: 'dropdown',
		label: field.label,
		id: field.id,
		default: field.default ?? spec.default(self),
		choices: spec.choices(self),
		...((field.allowCustom ?? true) ? { allowCustom: true as const } : {}),
		...(field.disableAutoExpression ? { disableAutoExpression: true as const } : {}),
		...(field.isVisibleExpression !== undefined ? { isVisibleExpression: field.isVisibleExpression } : {}),
	}
}

/** The multi-select form of `choiceDropdown`, for options that target several entities at once. */
export function choiceMultiDropdown<TKey extends string>(
	self: OBSInstance,
	list: ChoiceListName,
	field: Omit<ChoiceDropdownField<TKey>, 'default'> & { default?: string[] },
): CompanionInputFieldMultiDropdown<TKey> {
	const spec: ChoiceListSpec = CHOICE_LISTS[list]
	return {
		type: 'multidropdown',
		label: field.label,
		id: field.id,
		default: field.default ?? [],
		choices: spec.choices(self),
		...((field.allowCustom ?? true) ? { allowCustom: true as const } : {}),
		...(field.disableAutoExpression ? { disableAutoExpression: true as const } : {}),
		...(field.isVisibleExpression !== undefined ? { isVisibleExpression: field.isVisibleExpression } : {}),
	}
}
