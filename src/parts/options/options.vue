<template>
	<div>
		<div class="text">This is the {{ $options.name.replace("-", " ") }} component!</div>
		<button class="send" @click="send()">Send Message</button>
		<div v-if="response" class="small-text">The background script replied "{{ response }}"</div>
		<img src="@assets/logo.png">
	</div>
</template>

<script>

export default {
	name: "options",
	data () {
		return {
			response: ""
		}
	},
	methods: {
		send() {
			chrome.runtime.sendMessage(this.$options.name, (response) => {
				this.response = response
				setTimeout(() => {
					this.response = ""
				}, 1000)
			})
		}
	},
}
</script>

<style lang="scss">
	@import"../global_styles.scss";
</style>
