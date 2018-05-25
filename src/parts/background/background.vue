<template>
	<div>
		<div class="text">This is the {{ $options.name.replace("-", " ") }} component!</div>
		<div v-for="entry of messages" :key="entry.message" class="small-text">
			<div class="message">
				<strong>{{ entry.sender }}</strong> sent "{{ entry.message }}""
			</div>
			<div class="reply">
				You replied "{{ entry.reply }}""
			</div>
		</div>
		<img src="@assets/logo.png">
	</div>
</template>

<script>
export default {
	name: "background",
	data () {
		return {
			messages: []
		}
	},
	created() {
		chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
			// <dev block>
			//this is necessary to connect to the development content script
			//chrome does not allow accessing the chrome.tabs api from the content script
			//or from webpages, links to chrome:// and related urls redirect to about:blank
			if (sender.url.indexOf("http://localhost") == 0) {
				
				let type = request.type
				switch(type) {
					case "update_url": {
						chrome.tabs.update({url: request.url})
					} break
					case "new_tab": {
						chrome.tabs.create({url: request.url})
					} break
					case "new_window": {
						chrome.windows.create({url: request.url})
					} break
				}
				return
			}
			// </dev block>
			let reply = `Hello ${request.replace("-", " ")}`
			this.messages.push({message: request, sender: sender.tab.title, reply:reply})
			sendResponse(reply)
		})
	}
}
</script>

<style lang="scss">
	@import"../global_styles.scss";
</style>
