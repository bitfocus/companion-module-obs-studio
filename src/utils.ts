import type { OBSInstance } from './main.js'

export function validName(self: OBSInstance, name: string): string {
	//Generate a valid name for use as a variable ID
	try {
		return name.replace(/[^a-z0-9-_.]+/gi, '_')
	} catch (error) {
		self.log('debug', `Unable to generate validName for ${name}: ${error} `)
		return name
	}
}

export function formatTimecode(self: OBSInstance, data: number): string {
	//Converts milliseconds into a readable time format (hh:mm:ss)
	try {
		const formattedTime = new Date(data).toISOString().slice(11, 19)
		return formattedTime
	} catch (error) {
		self.log('debug', `Error formatting timecode: ${error} `)
		return '00:00:00'
	}
}

export function roundNumber(self: OBSInstance, number: number, decimalPlaces: number): number {
	//Rounds a number to a specified number of decimal places
	try {
		return Number(Math.round(Number(number + 'e' + (decimalPlaces ?? 0))) + 'e-' + (decimalPlaces ?? 0))
	} catch (error) {
		self.log('debug', `Error rounding number ${number}: ${error} `)
		return typeof number === 'number' ? number : 0
	}
}

export function rgbaToObsColor(rgbaString: string): number {
	// OBS expects colors as 32-bit integers: (alpha << 24) | (blue << 16) | (green << 8) | red
	// Parse rgba(r, g, b, a) format
	const match = rgbaString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
	if (!match) {
		// If not in expected format, try to parse as integer or return 0
		const parsed = parseInt(rgbaString, 10)
		return isNaN(parsed) ? 0 : parsed
	}

	const r = parseInt(match[1], 10)
	const g = parseInt(match[2], 10)
	const b = parseInt(match[3], 10)
	const a = match[4] ? Math.round(parseFloat(match[4]) * 255) : 255

	return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0
}
