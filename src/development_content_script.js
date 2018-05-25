function find (el, selector) {
	if (el.matches(selector)) {
		return el
	} else {
		return find(el.parentNode, selector)
	}
};

document.querySelectorAll("#contents a").forEach(element => {
	element.addEventListener("click", function(event) {
		let el= event.target
		el = find(element, "a")
		event.preventDefault()
		let path = el.getAttribute("href")
		//emulate native shortcuts
		let type = "update_url"
		if (event.ctrlKey) {type = "new_tab"}
		if (event.shiftKey) {type = "new_window"}

		if (el.classList.contains("chrome-extension")) {
			chrome.runtime.sendMessage({type: type, url: `chrome-extension://${chrome.runtime.id}/${path}`})
		} else {
			chrome.runtime.sendMessage({type: type, url: `${path}`})
		}
	})
})