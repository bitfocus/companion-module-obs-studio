import { CompanionActionDefinitions } from '@companion-module/base'
import type { OBSInstance } from '../main.js'

export function getStudioModeTransitionActions(self: OBSInstance): CompanionActionDefinitions {
	const actions: CompanionActionDefinitions = {}

	actions['enable_studio_mode'] = {
		name: 'Studio Mode - Enable',
		description: 'Enables Studio Mode, which allows for previewing changes before they go live',
		options: [],
		callback: async () => {
			await self.obs.sendRequest('SetStudioModeEnabled', { studioModeEnabled: true })
		},
	}
	actions['disable_studio_mode'] = {
		name: 'Studio Mode - Disable',
		description: 'Disables Studio Mode, making all changes go directly to program',
		options: [],
		callback: async () => {
			await self.obs.sendRequest('SetStudioModeEnabled', { studioModeEnabled: false })
		},
	}
	actions['toggle_studio_mode'] = {
		name: 'Studio Mode - Toggle',
		description: 'Toggles Studio Mode between on and off',
		options: [],
		callback: async () => {
			await self.obs.sendRequest('SetStudioModeEnabled', { studioModeEnabled: self.states.studioMode ? false : true })
		},
	}

	actions['do_transition'] = {
		name: 'Transition - Perform Transition',
		description: 'Transitions the current preview scene to program using the current transition',
		options: [],
		callback: async () => {
			if (self.states.studioMode) {
				await self.obs.sendRequest('TriggerStudioModeTransition')
			} else {
				self.log(
					'warn',
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
				id: 'duration',
				default: 500,
				min: 0,
				max: 60 * 1000, //max is required by api
				range: false,
				isVisibleExpression: `$(options:customDuration)`,
			},
		],
		callback: async (action) => {
			if (action.options.transition == 'Default' && !action.options.customDuration) {
				await self.obs.sendRequest('TriggerStudioModeTransition')
			} else {
				const revertTransition = self.states.currentTransition ?? 'Cut'
				const revertTransitionDuration =
					self.states.transitionDuration !== undefined ? Number(self.states.transitionDuration) : 0
				let duration
				if (action.options.customDuration) {
					duration = action.options.duration as number
				} else {
					duration =
						self.states.transitions.get(action.options.transition as string)?.transitionFixedDuration ??
						(self.states.transitionDuration !== undefined && self.states.transitionDuration > 0
							? Number(self.states.transitionDuration)
							: 500)
				}
				if (!self.states.transitionActive) {
					self.states.transitionActive = true
					await self.obs.sendBatch([
						{
							requestType: 'SetCurrentSceneTransition',
							requestData: { transitionName: action.options.transition as string },
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
			const transition = action.options.transitions as string
			await self.obs.sendRequest('SetCurrentSceneTransition', { transitionName: transition })
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

			if (action.options.adjust === 'next') {
				const nextTransition =
					self.obsState.transitionList[currentTransitionIndex + 1]?.id ??
					(self.obsState.transitionList[0]?.id as string)
				await self.obs.sendRequest('SetCurrentSceneTransition', { transitionName: nextTransition as string })
			} else if (action.options.adjust === 'previous') {
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
			const duration = action.options.duration as number
			if (duration !== null) {
				await self.obs.sendRequest('SetCurrentSceneTransitionDuration', { transitionDuration: duration })
			}
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
				let duration = Number(self.states.transitionDuration) + (action.options.amount as number)
				if (duration > 60000) {
					duration = 60000
				} else if (duration < 0) {
					duration = 0
				}
				if (duration !== null) {
					await self.obs.sendRequest('SetCurrentSceneTransitionDuration', { transitionDuration: duration })
				}
			} else {
				self.log('warn', 'Unable to adjust transition duration')
			}
		},
	}

	return actions
}
