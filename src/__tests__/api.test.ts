import { beforeEach, describe, expect, test } from 'vitest'
import { makeMockInstance, type MockInstance } from './mock/instance.js'

describe('OBSApi.buildProfileList', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
	})

	test('populates profile state from the GetProfileList response', async () => {
		self.socket.call.mockResolvedValue({
			currentProfileName: 'Streaming',
			profiles: ['Streaming', 'Recording'],
		})

		await self.obs.buildProfileList()

		expect(self.socket.call).toHaveBeenCalledWith('GetProfileList', undefined)
		expect(self.states.currentProfile).toBe('Streaming')
		expect([...self.states.profiles.keys()]).toEqual(['Streaming', 'Recording'])
		expect(self.checkFeedbacks).toHaveBeenCalledWith('profile_active')
		expect(self.setVariableValues).toHaveBeenCalledWith({ profile: 'Streaming' })
	})

	test('falls back to "None" when the request fails', async () => {
		self.socket.call.mockRejectedValue(new Error('not connected'))

		await self.obs.buildProfileList()

		expect(self.states.currentProfile).toBe('None')
		expect(self.states.profiles.size).toBe(0)
	})
})
