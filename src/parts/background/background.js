import Vue from "vue"
import Background from "./background.vue"

new Vue({
	el: "#app",
	el: "#app",
	render: h => h(Background)
})

chrome.runtime.onInstalled.addListener(function() {
	chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
		chrome.declarativeContent.onPageChanged.addRules([
			{
				conditions: [
					new chrome.declarativeContent.PageStateMatcher({
						pageUrl: { 
							hostEquals: "localhost", 
						},
					}),
				],
				actions: [ new chrome.declarativeContent.ShowPageAction() ]
			},
			{
				conditions: [
					new chrome.declarativeContent.PageStateMatcher({
						pageUrl: { 
							urlContains: "chrome-extension://", 
						},
					}),
				],
				actions: [ new chrome.declarativeContent.ShowPageAction() ]
			}
		])
	})
})
