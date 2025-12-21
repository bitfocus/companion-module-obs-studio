import { InstanceBase, InstanceStatus, runEntrypoint, SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields } from './config.js'
import { getActions } from './actions.js'
import { getPresets } from './presets.js'
import { getVariables, updateVariableValues } from './variables.js'
import { getFeedbacks } from './feedbacks.js'
import UpgradeScripts from './upgrades.js'
import { ModuleConfig, OBSNormalizedState } from './types.js'
import { OBSState } from './state.js'

import OBSWebSocket from 'obs-websocket-js'
import { OBSApi } from './api.js'

export class OBSInstance extends InstanceBase<ModuleConfig> {
	public socket!: OBSWebSocket
	public obs!: OBSApi
	public obsState!: OBSState
	public config!: ModuleConfig

	public reconnectionPoll?: NodeJS.Timeout
	public statsPoll?: NodeJS.Timeout
	public mediaPoll?: NodeJS.Timeout | null

	public get states(): OBSNormalizedState {
		return this.obsState.state
	}

	constructor(internal: unknown) {
		super(internal)
	}

	//Companion Internal and Configuration
	async init(config: ModuleConfig): Promise<void> {
		this.updateStatus(InstanceStatus.Connecting)
		this.config = config
		this.obs = new OBSApi(this)
		this.obsState = new OBSState()

		if (this.config?.host && this.config?.port) {
			void this.obs.connectOBS()
		} else if (this.config?.host && !this.config?.port) {
			this.updateStatus(InstanceStatus.BadConfig, 'Missing WebSocket Server port')
		} else if (!this.config?.host && this.config?.port) {
			this.updateStatus(InstanceStatus.BadConfig, 'Missing WebSocket Server IP address or hostname')
		} else {
			this.updateStatus(InstanceStatus.BadConfig, 'Missing WebSocket Server connection info')
		}
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config
		void this.init(config)
	}

	async destroy(): Promise<void> {
		void this.obs.disconnectOBS()
		void this.obs.stopReconnectionPoll()
	}

	initVariables(): void {
		const variables = getVariables.bind(this)()
		this.setVariableDefinitions(variables)
		updateVariableValues.bind(this)()
	}

	initFeedbacks(): void {
		const feedbacks = getFeedbacks.bind(this)()
		this.setFeedbackDefinitions(feedbacks)
	}

	initPresets(): void {
		const presets = getPresets.bind(this)()
		this.setPresetDefinitions(presets)
	}

	initActions(): void {
		const actions = getActions.bind(this)()
		this.setActionDefinitions(actions)
	}

	async updateActionsFeedbacksVariables(): Promise<void> {
		this.initVariables()
		this.initFeedbacks()
		this.initPresets()
		this.initActions()
	}
}
runEntrypoint(OBSInstance, UpgradeScripts as any)
