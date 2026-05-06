import { Regex, type SomeCompanionConfigField } from '@companion-module/base'

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Server IP / Hostname',
			width: 8,
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'Server Port',
			width: 4,
			default: '4455',
			regex: Regex.PORT,
		},
		{
			type: 'secret-text',
			id: 'pass',
			label: 'Server Password',
			width: 4,
		},
		{
			type: 'dropdown',
			id: 'scheme',
			label: 'Server Connection Type',
			default: 'ws',
			choices: [
				{ id: 'ws', label: 'WebSocket (ws)' },
				{ id: 'wss', label: 'Secure WebSocket (wss)' },
			],
			tooltip:
				'By default, a WebSocket (ws) connection is used. Set to Secure WebSocket (wss) if you have specifically configured a secure connection.',
			width: 4,
		},
	]
}
