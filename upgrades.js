module.exports = {
	websocket5upgrades: function (context, config, actions, feedbacks) {
		let changed = false

		actions.forEach((action) => {
			if (action.action === 'set-freetype-text' || action.action === 'set-gdi-text') {
				action.action = 'setText'
				changed = true
			}
		})
		return changed
	},
}
