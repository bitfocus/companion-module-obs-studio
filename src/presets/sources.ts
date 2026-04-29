import { CompanionPresetDefinitions } from '@companion-module/base'
import { Color } from '../utils.js'
import type OBSInstance from '../main.js'

export function getSourcePresets(self: OBSInstance): CompanionPresetDefinitions {
	const presets: CompanionPresetDefinitions = {}

	const processedSources = new Set<string>()

	for (const scene of self.obsState.sceneChoices) {
		const sceneUuid = scene.id as string
		const sceneItems = self.obsState.state.sceneItems.get(sceneUuid) ?? []

		if (sceneItems.length > 0) {
			for (const item of sceneItems) {
				const sourcesToProcess = []
				if (item.isGroup) {
					const groupItems = self.obsState.state.groups.get(item.sourceUuid) ?? []
					sourcesToProcess.push(...groupItems)
				} else {
					sourcesToProcess.push(item)
				}

				for (const sourceItem of sourcesToProcess) {
					processedSources.add(sourceItem.sourceUuid)
					presets[`sourceStatus_${sceneUuid}_${sourceItem.sourceUuid}`] = {
						type: 'simple',
						name: `${sourceItem.sourceName} Status (${scene.label})`,
						style: {
							text: sourceItem.sourceName,
							size: 'auto',
							color: Color.White,
							bgcolor: Color.Black,
							show_topbar: false,
						},
						steps: [
							{
								down: [],
								up: [],
							},
						],
						feedbacks: [
							{
								feedbackId: 'scene_item_previewed',
								options: {
									source: sourceItem.sourceUuid,
								},
								style: {
									bgcolor: Color.Green,
									color: Color.White,
								},
							},
							{
								feedbackId: 'scene_item_active',
								options: {
									scene: 'anyScene',
									source: sourceItem.sourceUuid,
								},
								style: {
									bgcolor: Color.Red,
									color: Color.White,
								},
							},
						],
					}
				}
			}
		}
	}

	const otherSources = self.obsState.sourceChoices.filter((s) => !processedSources.has(s.id as string))
	if (otherSources.length > 0) {
		for (const source of otherSources) {
			presets[`sourceStatus_other_${source.id}`] = {
				type: 'simple',
				name: `${source.label} Status`,
				style: {
					text: source.label,
					size: 'auto',
					color: Color.White,
					bgcolor: Color.Black,
				},
				steps: [
					{
						down: [],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'scene_item_previewed',
						options: {
							source: source.id,
						},
						style: {
							bgcolor: Color.Green,
							color: Color.White,
						},
					},
					{
						feedbackId: 'scene_item_active',
						options: {
							scene: 'anyScene',
							source: source.id,
						},
						style: {
							bgcolor: Color.Red,
							color: Color.White,
						},
					},
				],
			}
		}
	}

	return presets
}
