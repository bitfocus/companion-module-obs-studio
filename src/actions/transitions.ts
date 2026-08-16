import { clamp } from '../utils.js'
import { CompanionActionDefinitions, createModuleLogger } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { SLEEP_MAX_MS } from '../constants.js'

const logger = createModuleLogger('Actions/Transitions')

export type TransitionActionSchemas = {
	do_transition: { options: Record<string, never> }
	quick_transition: { options: { transition: string; customDuration: boolean; transition_time: number } }
	transition_type: { options: { mode: 'set' | 'next' | 'previous'; transitions: string } }
	transition_duration: { options: { mode: 'set' | 'adjust'; value: number; amount: number } }
}

export function getTransitionActions(self: OBSInstance): CompanionActionDefinitions<TransitionActionSchemas> {
	return {
		do_transition: {
			name: 'Transition - Perform Transition',
			description: 'Transitions the current preview scene to program using the current transition',
			options: [],
			callback: async () => {
				if (self.states.studioMode) {
					await self.obs.sendRequest('TriggerStudioModeTransition')
				} else {
					logger.warn(
						'Transition Preview to Program action only works when Studio Mode is enabled. Use the Set Scene action instead.',
					)
				}
			},
		},

		quick_transition: {
			name: 'Transition - Quick Transition',
			description: 'Performs a quick transition using a specific transition type and optional custom duration',
			options: [
				{
					type: 'dropdown',
					label: 'Transition',
					id: 'transition',
					default: self.obsState.transitionList?.[0] ? self.obsState.transitionList[0].id : '',
					choices: self.obsState.transitionList,
				},
				{
					type: 'checkbox',
					label: 'Custom Duration',
					id: 'customDuration',
					default: false,
				},
				{
					type: 'number',
					label: 'Transition time (in ms)',
					id: 'transition_time',
					default: 500,
					min: 0,
					max: 60 * 1000, // Max is required by API
					clampValues: true,
					isVisibleExpression: `$(options:customDuration)`,
				},
			],
			callback: async (action) => {
				if (action.options.transition === 'Default' && !action.options.customDuration) {
					await self.obs.sendRequest('TriggerStudioModeTransition')
				} else {
					const revertTransition = self.states.currentTransition ?? 'Cut'
					const revertTransitionDuration =
						self.states.transitionDuration !== undefined ? Number(self.states.transitionDuration) : 0
					let duration
					if (action.options.customDuration) {
						duration = action.options.transition_time
					} else {
						duration =
							self.states.transitions.get(action.options.transition)?.transitionFixedDuration ??
							(self.states.transitionDuration !== undefined && self.states.transitionDuration > 0
								? Number(self.states.transitionDuration)
								: 500)
					}
					if (!self.states.transitionActive) {
						self.states.transitionActive = true
						await self.obs.sendBatch([
							{
								requestType: 'SetCurrentSceneTransition',
								requestData: { transitionName: action.options.transition },
							},
							{
								requestType: 'SetCurrentSceneTransitionDuration',
								requestData: { transitionDuration: duration },
							},
							{
								requestType: 'TriggerStudioModeTransition',
							},
							{
								requestType: 'Sleep',
								// sleepMillis is capped by the protocol; exceeding it fails the Sleep and reverts early.
								requestData: { sleepMillis: clamp(duration + 100, 0, SLEEP_MAX_MS) },
							},
							{
								requestType: 'SetCurrentSceneTransition',
								requestData: { transitionName: revertTransition },
							},
							{
								requestType: 'SetCurrentSceneTransitionDuration',
								requestData: { transitionDuration: revertTransitionDuration },
							},
						])
						setTimeout(() => {
							self.states.transitionActive = false
						}, duration + 50)
					}
				}
			},
		},

		transition_type: {
			name: 'Transition - Type',
			description: 'Sets the current transition type used for Studio Mode transitions, or cycles through the list',
			options: [
				{
					type: 'dropdown',
					disableAutoExpression: true,
					label: 'Mode',
					id: 'mode',
					default: 'set',
					choices: [
						{ id: 'set', label: 'Set Type' },
						{ id: 'next', label: 'Next Type' },
						{ id: 'previous', label: 'Previous Type' },
					],
				},
				{
					type: 'dropdown',
					label: 'Transitions',
					id: 'transitions',
					default: self.obsState.transitionList?.[0] ? self.obsState.transitionList[0].id : '',
					choices: self.obsState.transitionList,
					isVisibleExpression: `$(options:mode) === 'set'`,
				},
			],
			callback: async (action) => {
				if (action.options.mode === 'set') {
					await self.obs.sendRequest('SetCurrentSceneTransition', { transitionName: action.options.transitions })
					return
				}

				const currentTransitionIndex = self.obsState.transitionList.findIndex(
					(item) => item.id === self.states.currentTransition,
				)

				const transitionName =
					action.options.mode === 'next'
						? (self.obsState.transitionList[currentTransitionIndex + 1]?.id ?? self.obsState.transitionList[0]?.id)
						: (self.obsState.transitionList[currentTransitionIndex - 1]?.id ??
							self.obsState.transitionList[self.obsState.transitionList.length - 1]?.id)

				await self.obs.sendRequest('SetCurrentSceneTransition', { transitionName: transitionName as string })
			},
			learn: () => {
				const transition = self.states.currentTransition
				if (!transition) return undefined
				return { mode: 'set', transitions: transition }
			},
		},

		transition_duration: {
			name: 'Transition - Duration',
			description: 'Sets or adjusts the duration for current transitions in milliseconds',
			options: [
				{
					type: 'dropdown',
					disableAutoExpression: true,
					label: 'Mode',
					id: 'mode',
					default: 'set',
					choices: [
						{ id: 'set', label: 'Set' },
						{ id: 'adjust', label: 'Adjust' },
					],
				},
				{
					type: 'number',
					label: 'Transition time (in ms)',
					id: 'value',
					default: 500,
					min: 0,
					max: 60 * 1000, // Max is required by API
					clampValues: true,
					isVisibleExpression: `$(options:mode) === 'set'`,
				},
				{
					type: 'number',
					label: 'Amount (in ms)',
					id: 'amount',
					default: 50,
					min: -60 * 1000,
					max: 60 * 1000,
					clampValues: true,
					isVisibleExpression: `$(options:mode) === 'adjust'`,
				},
			],
			callback: async (action) => {
				let duration: number
				if (action.options.mode === 'set') {
					duration = action.options.value
				} else if (self.states.transitionDuration !== undefined) {
					duration = clamp(Number(self.states.transitionDuration) + action.options.amount, 0, 60 * 1000)
				} else {
					logger.warn('Unable to adjust transition duration')
					return
				}

				await self.obs.sendRequest('SetCurrentSceneTransitionDuration', { transitionDuration: duration })
			},
			learn: () => {
				const duration = self.states.transitionDuration
				if (duration === undefined) return undefined
				return { mode: 'set', value: Number(duration) }
			},
		},
	}
}
