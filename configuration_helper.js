const fs = require("fs-extra")
const sharp = require("sharp")

module.exports = {
	icon_handler(content, content_path, source_path, build_path, icons_dir, icons_to_manifest) {
		//get icon name from path passed
		content_path.replace(/(.*\\)(.*?icon.*?)\.(.*)$/gm, function (match, path, matched_name, type) {
			let size_in_name = false
			let name = matched_name.replace(/(-\d{1,})/g, (match, size) => {
				size = size_in_name
				return ""
			})
			if (size_in_name) {return content}
			if (["icon", "page-action-icon", "browser-action-icon"].includes(name)) {
				let sizes = ["16","48","128"]
				let sizes_override = []
				sizes.map(size => {
					icons_to_manifest.push([name, size])
					let exists = fs.existsSync(`${source_path}/${icons_dir}/${name}-${size}.${type}`)
					let exists_svg = fs.existsSync(`${source_path}/${icons_dir}/${name}-${size}.svg`)
						
					if (!exists_svg && (!exists || type == "svg")) {
						fs.ensureDirSync(`${build_path}/${icons_dir}/`)//directory might not exist and we'll get errors
						sharp(content)
							.resize(parseInt(size),parseInt(size))
							.png()
							.toFile(`${build_path}/${icons_dir}/${name}-${size}.png`, function(err, info) {
								if (err) {console.warn(err)}
							})
					} else if (exists_svg) {
						//queues up svg override
						sizes_override.push([`${source_path}/${icons_dir}/${name}-${size}.svg`, `${build_path}/${icons_dir}/${name}-${size}.png`, size])
					} else {
						sharp(`${source_path}/${icons_dir}/${name}-${size}.${type}`)
							.resize(parseInt(size),parseInt(size))
							.png()
							.toFile(`${build_path}/${icons_dir}/${name}-${size}.png`, function(err, info) {
								if (err) {console.warn(err)}
							})
					}
				})
				sizes_override.map(([input_path, output_path, size]) => {
					fs.ensureDirSync(output_path.replace(/(.*)\/.*$/g, "$1"))//directory might not exist and we'll get errors
					sharp(input_path)
						.resize(parseInt(size),parseInt(size))
						.png()
						.toFile(output_path, function(err, info) {
							if (err) {console.warn(err)}
						})
				})
			}
		})
		return content
	},
	manifest_configurator(content, content_path, env, port, parts, icons_dir, type_of_background, icons_to_manifest) {
		//creates the manifest file using info from our package.json and our files
		//any entries in the existing manifest override it
		//but it can't override icons or the location of files
		//manifest reference: https://developer.chrome.com/extensions/manifest
		content = JSON.parse(content.toString())
		let manifest = {
			name: process.env.npm_package_name,
			description: process.env.npm_package_description,
			version: process.env.npm_package_version,
			manifest_version: 2,
			...content
		}

		for (part_entry of parts) {
			let part_name  = part_entry.name
			let part = part_entry.alias
			
			switch(part_name) {
				case "popup": {
					manifest.browser_action = manifest.browser_action || {}
					manifest.browser_action.default_popup = `${part}/${part}.html`
				} break
				case "page_popup": {
					manifest.page_action = manifest.page_action || {}
					manifest.page_action.default_popup = `${part}/${part}.html`
				} break
				case "background": {
					manifest.background = manifest.background || {}
					if (type_of_background == "html") {
						manifest.background.page = `${part}/${part}.html`
					} else {
						manifest.background.scripts = manifest.background.scripts || []
						manifest.background.scripts.push(`${part}/${part}.js`)
					}
					manifest.background.persistant = manifest.background.persistant || "false"
				//see https://developer.chrome.com/extensions/background_pages as to why persistant is usually false
				} break
				case "options": {
					if (manifest.options_ui) {
					//embeded options
					//see https://developer.chrome.com/extensions/options#embedded_options
						manifest.options_ui = manifest.options_ui || {}
						manifest.options_ui.page = `${part}/${part}.html`
						manifest.options_ui.open_in_tab = manifest.open_in_tab || false
					} else {
						manifest.options_page = `${part}/${part}.html`
					}
				} break
				//not completely tested
				case "devtools": {
					manifest.devtools_page = `${part}/${part}.html`
				} break
				case "scripts" : {
					let files = scripts_files.map(file => `${part}/${file}`)
					manifest.background = manifest.background || {}
					manifest.background.scripts = manifest.background.scripts || []
					manifest.background.scripts = [...manifest.background.scripts, ...files]
					manifest.background.persistant = manifest.background.persistant || "false"
				//see https://developer.chrome.com/extensions/background_pages as to why persistant is usually false
				} break
				case "content_scripts": {
					let scripts = content_scripts_files
						.filter(file => {return file.slice(-3) == ".js"})
						.map(file => {return file.slice(0,-3)})
					for (let type of scripts) {
						manifest.content_scripts = manifest.content_scripts || []
						let exists = manifest.content_scripts.findIndex(entry => entry.js == `${part}/${type}.js`)
						if (exists == -1) {
							let entry = {
								matches: ["<all_urls>"],
								js: [`./${part}/${type}.js`]
							}
							if (content_scripts_files.includes(`${type}.css`)) {
								entry.css = `${part}/${type}.css`
							}
							manifest.content_scripts.push(entry)
						} else {
						//in case we forgot to specify css or matches
							if (!manifest.content_scripts[exists].css && content_scripts_files.includes(`${type}.css`)) {
								manifest.content_scripts[exists].css = `${part}/${type}.css`
							}
							if (!manifest.content_scripts[exists].matches) {
								manifest.content_scripts[exists].matches = ["*"]
							}
						}
					}
				} break
				case "development_content_script": {
					manifest.content_scripts = manifest.content_scripts || []
					let entry = {
						matches: [`http://localhost:${port || "8080"}/*`],
						js: [`content_scripts/${part}`]
					}
					manifest.content_scripts.push(entry)

					//add necessary permissions
					manifest.permissions = manifest.permissions || []
					
					if (manifest.permissions.indexOf("tabs") == -1) {
						console.warn("\n\nNOTE: \"tabs\" permission was added for development only.\n\n")
						manifest.permissions.push("tabs")
					}
				}
			}
		}
		for (let [name, size] of icons_to_manifest) {
			let type = name.slice(0, -5).replace("-", "_") || "icon"
			if (type == "icon") {
				manifest.icons = manifest.icons|| {}
				manifest.icons[size] = `${icons_dir}/${name}-${size}.png`
			} else {
				if (manifest[type]) {
					//icons will not be set if that part doesn't already exist
					manifest[type].default_icon = manifest[type].default_icon || {}
					manifest[type].default_icon[size] = `${icons_dir}/${name}-${size}.png`
				}
			}
		}
		return Buffer.from(JSON.stringify(manifest, null, "\t"))
	}
}