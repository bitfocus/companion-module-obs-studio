import {
	CompanionRecordedAction,
	type CompanionVariableValues,
	InstanceBase,
	InstanceStatus,
	type InstanceTypes,
	SomeCompanionConfigField,
} from '@companion-module/base'
import { GetConfigFields } from './config.js'
import { getActions, type OBSActionSchemas } from './actions.js'
import { getPresets } from './presets.js'
import { getVariables, updateVariableValues } from './variables.js'
import { getFeedbacks, type OBSFeedbackSchemas } from './feedbacks.js'
import UpgradeScripts from './upgrades.js'
import { ModuleConfig, ModuleSecrets, OBSNormalizedState } from './types.js'
import { OBSState } from './state.js'
import { VariablePublisher } from './variable-publisher.js'

import OBSWebSocket from 'obs-websocket-js'
import { OBSApi } from './api.js'

export interface OBSInstanceTypes extends InstanceTypes {
	config: ModuleConfig
	secrets: ModuleSecrets
	actions: OBSActionSchemas
	feedbacks: OBSFeedbackSchemas
	// Variables stay untyped: many are built from dynamic per-source keys.
	variables: CompanionVariableValues
}

export default class OBSInstance extends InstanceBase<OBSInstanceTypes> {
	public socket!: OBSWebSocket
	public obs!: OBSApi
	public obsState!: OBSState
	public config!: ModuleConfig
	public secrets!: ModuleSecrets

	public isRecordingActions: boolean = false

	public reconnectionPoll?: NodeJS.Timeout
	public statsPoll?: NodeJS.Timeout
	public mediaPoll?: NodeJS.Timeout

	// Suppresses republishing variable values that have not changed.
	private readonly variablePublisher = new VariablePublisher()

	// Coalesces definition rebuilds into a single pass.
	private rebuildTimer?: NodeJS.Timeout
	private static readonly REBUILD_DEBOUNCE_MS = 100

	public get states(): OBSNormalizedState {
		return this.obsState.state
	}

	constructor(internal: unknown) {
		super(internal)
	}

	// Companion configuration and lifecycle
	async init(config: ModuleConfig, _isFirstInit: boolean, secrets: ModuleSecrets): Promise<void> {
		this.updateStatus(InstanceStatus.Connecting)
		this.config = config
		this.secrets = secrets
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

	async configUpdated(config: ModuleConfig, secrets: ModuleSecrets): Promise<void> {
		await this.obs.disconnectOBS()
		this.config = config
		this.secrets = secrets
		void this.init(config, false, secrets)
	}

	async destroy(): Promise<void> {
		if (this.rebuildTimer) {
			clearTimeout(this.rebuildTimer)
			this.rebuildTimer = undefined
		}
		void this.obs.disconnectOBS()
		this.obs.stopReconnectionPoll()
	}

	/**
	 * Every variable write goes through here, so the polls can keep publishing their whole set each
	 * tick while only changed values actually reach the host.
	 */
	override setVariableValues(values: CompanionVariableValues): void {
		const changed = this.variablePublisher.filterChanged(values)
		if (changed) super.setVariableValues(changed)
	}

	initVariables(): void {
		// Redefining variables drops the host's values for them, so the next write must republish in
		// full rather than being filtered against what the host no longer has.
		this.variablePublisher.reset()
		const variables = getVariables.call(this)
		this.setVariableDefinitions(variables)
		updateVariableValues.call(this)
	}

	initFeedbacks(): void {
		const feedbacks = getFeedbacks.call(this)
		this.setFeedbackDefinitions(feedbacks)
	}

	initPresets(): void {
		const { presets, structure } = getPresets.call(this)
		this.setPresetDefinitions(structure, presets)
	}

	initActions(): void {
		const actions = getActions.call(this)
		this.setActionDefinitions(actions)
	}

	updateActionsFeedbacksVariables(): void {
		if (this.rebuildTimer) clearTimeout(this.rebuildTimer)
		this.rebuildTimer = setTimeout(() => {
			this.rebuildTimer = undefined
			this.rebuildDefinitions()
		}, OBSInstance.REBUILD_DEBOUNCE_MS)
	}

	private rebuildDefinitions(): void {
		// Cache choices/indexes for rebuild, then clear to avoid stale state.
		this.obsState.beginCache()
		try {
			this.initVariables()
			this.initFeedbacks()
			this.initActions()
			this.initPresets()
		} finally {
			this.obsState.endCache()
		}
	}

	handleStartStopRecordActions(isRecording: boolean): void {
		this.isRecordingActions = isRecording
	}

	sendToActionRecorder(action: CompanionRecordedAction, uniquenessId?: string): void {
		if (!this.isRecordingActions) return
		const timestamp = Date.now()
		uniquenessId = uniquenessId ?? timestamp.toString()
		this.recordAction(action, uniquenessId)
	}
}

export { UpgradeScripts }
