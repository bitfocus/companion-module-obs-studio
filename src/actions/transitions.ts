import { opt } from '../utils.js'
import { CompanionActionDefinitions, createModuleLogger } from '@companion-module/base'
import type OBSInstance from '../main.js'

const logger = createModuleLogger('Actions/Transitions')

export function getTransitionActions(self: OBSInstance): CompanionActionDefinitions {
	const actions: CompanionActionDefinitions = {}
	actions['do_transition'] = {
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
	}

	actions['quick_transition'] = {
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
				max: 60 * 1000, //max is required by api
				range: false,
				isVisibleExpression: `$(options:customDuration)`,
			},
		],
		callback: async (action) => {
			if (opt<any>(action, 'transition') === 'Default' && !opt<any>(action, 'customDuration')) {
				await self.obs.sendRequest('TriggerStudioModeTransition')
			} else {
				const revertTransition = self.states.currentTransition ?? 'Cut'
				const revertTransitionDuration =
					self.states.transitionDuration !== undefined ? Number(self.states.transitionDuration) : 0
				let duration
				if (opt<any>(action, 'customDuration')) {
					duration = opt<number>(action, 'transition_time')
				} else {
					duration =
						self.states.transitions.get(opt<string>(action, 'transition'))?.transitionFixedDuration ??
						(self.states.transitionDuration !== undefined && self.states.transitionDuration > 0
							? Number(self.states.transitionDuration)
							: 500)
				}
				if (!self.states.transitionActive) {
					self.states.transitionActive = true
					await self.obs.sendBatch([
						{
							requestType: 'SetCurrentSceneTransition',
							requestData: { transitionName: opt<string>(action, 'transition') },
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
							requestData: { sleepMillis: duration + 100 },
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
	}

	actions['set_transition_type'] = {
		name: 'Transition - Set Type',
		description: 'Sets the current transition type used for Studio Mode transitions',
		options: [
			{
				type: 'dropdown',
				label: 'Transitions',
				id: 'transitions',
				default: self.obsState.transitionList?.[0] ? self.obsState.transitionList[0].id : '',
				choices: self.obsState.transitionList,
			},
		],
		callback: async (action) => {
			const transition = opt<string>(action, 'transitions')
			await self.obs.sendRequest('SetCurrentSceneTransition', { transitionName: transition })
		},
		learn: () => {
			const transition = self.states.currentTransition
			if (!transition) return undefined
			return { transitions: transition }
		},
	}
	actions['adjustTransitionType'] = {
		name: 'Transition - Adjust Type',
		description: 'Cycles through the list of transitions',
		options: [
			{
				type: 'dropdown',
				label: 'Adjust',
				id: 'adjust',
				default: 'next',
				choices: [
					{ id: 'next', label: 'Next' },
					{ id: 'previous', label: 'Previous' },
				],
			},
		],
		callback: async (action) => {
			const currentTransition = self.states.currentTransition
			const currentTransitionIndex = self.obsState.transitionList.findIndex((item) => item.id === currentTransition)

			if (opt<any>(action, 'adjust') === 'next') {
				const nextTransition =
					self.obsState.transitionList[currentTransitionIndex + 1]?.id ?? self.obsState.transitionList[0]?.id
				await self.obs.sendRequest('SetCurrentSceneTransition', { transitionName: nextTransition as string })
			} else if (opt<any>(action, 'adjust') === 'previous') {
				const previousTransition =
					(self.obsState.transitionList[currentTransitionIndex - 1]?.id as string) ??
					(self.obsState.transitionList[self.obsState.transitionList.length - 1]?.id as string)
				await self.obs.sendRequest('SetCurrentSceneTransition', { transitionName: previousTransition })
			}
		},
	}

	actions['set_transition_duration'] = {
		name: 'Transition - Set Duration',
		description: 'Sets the duration for current transitions in milliseconds',
		options: [
			{
				type: 'number',
				label: 'Transition time (in ms)',
				id: 'duration',
				default: 500,
				min: 0,
				max: 60 * 1000, //max is required by api
				range: false,
			},
		],
		callback: async (action) => {
			const duration = opt<number>(action, 'duration')
			if (duration !== null) {
				await self.obs.sendRequest('SetCurrentSceneTransitionDuration', { transitionDuration: duration })
			}
		},
		learn: () => {
			const duration = self.states.transitionDuration
			if (duration !== undefined) {
				return {
					duration: Number(duration),
				}
			}
			return undefined
		},
	}

	actions['adjust_transition_duration'] = {
		name: 'Transition - Adjust Duration',
		description: 'Adjusts the current transition duration by a specific amount of milliseconds',
		options: [
			{
				type: 'number',
				label: 'Amount (in ms)',
				id: 'amount',
				default: 50,
				min: -60 * 1000,
				max: 60 * 1000,
				range: false,
			},
		],
		callback: async (action) => {
			if (self.states.transitionDuration !== undefined) {
				let duration = Number(self.states.transitionDuration) + opt<number>(action, 'amount')
				if (duration > 60000) {
					duration = 60000
				} else if (duration < 0) {
					duration = 0
				}
				if (duration !== null) {
					await self.obs.sendRequest('SetCurrentSceneTransitionDuration', { transitionDuration: duration })
				}
			} else {
				logger.warn('Unable to adjust transition duration')
			}
		},
	}
	return actions
}
