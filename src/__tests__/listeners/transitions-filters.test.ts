import { beforeEach, describe, expect, test } from 'vitest'
import { initOBSListeners } from '../../listeners.js'
import { makeMockInstance, seedSource, type MockInstance } from '../mock/instance.js'

describe('transition listeners', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		self.isRecordingActions = true
		self.states.transitions.set('Fade', {
			transitionName: 'Fade',
			transitionUuid: 'Fade',
			transitionType: 'fade_transition',
			transitionFixed: false,
			transitionConfigurable: true,
		})
		initOBSListeners(self)
	})

	test('CurrentSceneTransitionChanged pulls the duration and records the change', async () => {
		self.socket.call.mockResolvedValue({ transitionName: 'Fade', transitionDuration: 300 })

		self.socket.emit('CurrentSceneTransitionChanged', { transitionName: 'Fade', transitionUuid: 'Fade' })
		await new Promise((resolve) => setImmediate(resolve))

		expect(self.states.currentTransition).toBe('Fade')
		expect(self.states.transitionDuration).toBe(300)
		expect(self.setVariableValues).toHaveBeenCalledWith({ current_transition: 'Fade', transition_duration: 300 })
		expect(self.sendToActionRecorder).toHaveBeenCalledWith({
			actionId: 'transition_type',
			options: { mode: 'set', transitions: 'Fade' },
		})
	})

	test('a transition the module has never seen triggers a list refresh', async () => {
		self.socket.call.mockResolvedValue({ transitionName: 'Stinger', transitionDuration: 0 })

		self.socket.emit('CurrentSceneTransitionChanged', { transitionName: 'Stinger', transitionUuid: 'stinger' })
		await new Promise((resolve) => setImmediate(resolve))

		expect(self.socket.call).toHaveBeenCalledWith('GetSceneTransitionList', undefined)
		expect(self.updateActionsFeedbacksVariables).toHaveBeenCalled()
	})

	test('a known transition does not refresh the list', async () => {
		self.socket.call.mockResolvedValue({ transitionName: 'Fade', transitionDuration: 300 })

		self.socket.emit('CurrentSceneTransitionChanged', { transitionName: 'Fade', transitionUuid: 'Fade' })
		await new Promise((resolve) => setImmediate(resolve))

		expect(self.socket.call).not.toHaveBeenCalledWith('GetSceneTransitionList', undefined)
	})

	test('a duration the request cannot supply falls back to zero', async () => {
		self.socket.call.mockResolvedValue(undefined)

		self.socket.emit('CurrentSceneTransitionChanged', { transitionName: 'Fade', transitionUuid: 'Fade' })
		await new Promise((resolve) => setImmediate(resolve))

		expect(self.states.transitionDuration).toBe(0)
	})

	test('CurrentSceneTransitionDurationChanged updates and records the duration', () => {
		self.socket.emit('CurrentSceneTransitionDurationChanged', { transitionDuration: 750 })

		expect(self.states.transitionDuration).toBe(750)
		expect(self.setVariableValues).toHaveBeenCalledWith({ transition_duration: 750 })
		expect(self.checkFeedbacks).toHaveBeenCalledWith('transition_duration')
		expect(self.sendToActionRecorder).toHaveBeenCalledWith({
			actionId: 'transition_duration',
			options: { mode: 'set', value: 750 },
		})
	})

	test('SceneTransitionStarted and Ended bracket transition_active', () => {
		self.socket.emit('SceneTransitionStarted', { transitionName: 'Fade', transitionUuid: 'Fade' })

		expect(self.states.transitionActive).toBe(true)
		// updateVariableValues writes this as a boolean too.
		expect(self.setVariableValues).toHaveBeenCalledWith({ transition_active: true })

		self.socket.emit('SceneTransitionEnded', { transitionName: 'Fade', transitionUuid: 'Fade' })

		expect(self.states.transitionActive).toBe(false)
		expect(self.setVariableValues).toHaveBeenCalledWith({ transition_active: false })
	})
})

describe('filter listeners', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		self.isRecordingActions = true
		seedSource(self, 'Mic', 'mic-uuid')
		self.states.sourceFilters.set('mic-uuid', [
			{ filterName: 'Gain', filterEnabled: true, filterIndex: 0, filterKind: 'gain_filter', filterSettings: {} },
		])
		initOBSListeners(self)
	})

	test.each(['SourceFilterCreated', 'SourceFilterRemoved', 'SourceFilterNameChanged'])(
		'%s refetches the whole filter list',
		(event) => {
			self.socket.emit(event, { sourceName: 'Mic', filterName: 'Gain', filterIndex: 0 })

			expect(self.socket.call).toHaveBeenCalledWith('GetSourceFilterList', { sourceUuid: 'mic-uuid' })
		},
	)

	test('an event for a source the module does not know is ignored', () => {
		self.socket.emit('SourceFilterCreated', { sourceName: 'Ghost', filterName: 'Gain', filterIndex: 0 })

		expect(self.socket.call).not.toHaveBeenCalled()
	})

	test('SourceFilterEnableStateChanged records the toggle against the source name', () => {
		self.socket.emit('SourceFilterEnableStateChanged', {
			sourceName: 'Mic',
			filterName: 'Gain',
			filterEnabled: false,
		})

		expect(self.states.sourceFilters.get('mic-uuid')![0].filterEnabled).toBe(false)
		expect(self.sendToActionRecorder).toHaveBeenCalledWith({
			actionId: 'toggle_filter',
			options: { target: 'source', source: 'Mic', filter: 'Gain', visible: 'false' },
		})
	})

	test('a state change for an unknown filter records but changes nothing', () => {
		self.socket.emit('SourceFilterEnableStateChanged', {
			sourceName: 'Mic',
			filterName: 'Nope',
			filterEnabled: false,
		})

		expect(self.states.sourceFilters.get('mic-uuid')![0].filterEnabled).toBe(true)
		expect(self.checkFeedbacks).not.toHaveBeenCalled()
	})

	test('SourceFilterSettingsChanged for an unknown filter is a no-op', () => {
		expect(() =>
			self.socket.emit('SourceFilterSettingsChanged', {
				sourceName: 'Mic',
				filterName: 'Nope',
				filterSettings: { db: 10 },
			}),
		).not.toThrow()
		expect(self.states.sourceFilters.get('mic-uuid')![0].filterSettings).toEqual({})
	})
})
