const webpack = require("webpack")
const path = require("path")
const CleanWebpackPlugin = require("clean-webpack-plugin")
const CopyWebpackPlugin = require("copy-webpack-plugin")
const HtmlWebpackPlugin = require("html-webpack-plugin")
const WriteFilePlugin = require("write-file-webpack-plugin")
const VueLoaderPlugin = require("vue-loader/lib/plugin")
const MiniCssExtractPlugin = require("mini-css-extract-plugin")
const fs = require("fs-extra")
const helpers = require("./configuration_helper.js")

module.exports = (env, {mode, port}) => {
	//makes it easier to check env variables
	env = typeof env == "undefined" ? {} : env

	//CONFIG
	let eslint_config = {
		fix: true,
		quiet: true,
		failOnError: true,
		emitWarning: true,
		formatter: require("eslint-friendly-formatter"),
	}
	
	//where the "parts" of the chrome extensions are
	let source_path = "./src"
	let extension_parts_path = `${source_path}/parts` //they don't have to be nested, should work if they aren't
	//to change the output paths (part/part.html) look at the configuration helper
	let build_path = "./dist"
	let assets_dir_name = "assets"
	let icons_dir = "icons" //for both output/input, originals are suffixed with -original
	
	//the allowed parts //can be renamed from here
	let paths = {
		popup:"popup",
		page_popup:"page_popup",
		background:"background",
		options:"options",
		devtools:"devtools",
		scripts:"scripts",
		content_scripts:"content_scripts",
		development_content_script: "development_content_script.js"
	}

	//DYNAMICALLY ADD ENTRIES

	//because we have so many entries it's easier to just add them in a for loop
	//the config options we'll be adding to in the for loop
	let options = {
		entry: {},
		plugins: []
	}

	//will be used to add sizes to manifest
	let icons_to_manifest = []

	//will be used to handle scripts and content_scripts
	let content_scripts_files = []
	let scripts_files = []

	//process our parts paths mappings
	let parts = Object.keys(paths).map(entry => {return {alias: paths[entry], name: entry}})

	//check whether the background is an html page or a script
	let type_of_background = fs.readdirSync(`${extension_parts_path}/background`).findIndex(file => {
		return file.includes(".html")
	}) == -1 ? "js" : "html"

	//for loop to add entries to our webpack options
	for (let index = 0; index < parts.length; index++) {
		//we're using index because we might splice the array in place
		let part_name  = parts[index].name
		let part = parts[index].alias

		//if it doesn't exist or it shouldn't remove it from our parts array
		if (!fs.existsSync(`${extension_parts_path}/${part}`) && (part_name !== "development_content_script" || mode == "production")) {
			parts.splice(index, 1)
			index = index - 1
			continue
		}
		if (part_name == "scripts") {
			scripts_files = fs.readdirSync(`${extension_parts_path}/scripts`)
			//add all paths to the entry
			for (let script of scripts_files) {
				options.entry[`${part}\\${script.slice(0,-3)}`] = `${extension_parts_path}/${part}/${script}`
			}
		} else if (part_name == "content_scripts") {
			content_scripts_files = fs.readdirSync(`${extension_parts_path}/content_scripts`)
			//add all paths to the entry
			for (let script of content_scripts_files.filter(file => {return file.slice(-3) == ".js"})) {
				let script_name = script.replace(/(.*)\..*$/g, "$1")
				let path = `${part}\\${script_name}`

				options.entry[path] = [`${extension_parts_path}/${part}/${script}`]
				let css_exists = content_scripts_files.findIndex(file => {
					return file.slice(-3) !== ".js" && file.replace(/(.*)\..*$/g, "$1") == script_name
				})
				if (css_exists !== -1) {
					options.entry[path].push(`${extension_parts_path}/${part}/${content_scripts_files[css_exists]}`)
				}

			}
		} else if (part_name == "development_content_script" && mode == "development"
			&& (!env.server_only)) {
			//inject our development content script that is used to give use our id
			options.plugins.push(
				new CopyWebpackPlugin([{
					from: `${source_path}/${part}`,
					to: `content_scripts/${part}`,
				}])
			)
		} else {
			//add it's path to the entry
			options.entry[`${part}\\${part}`] = `${extension_parts_path}/${part}/${part}.js`
			//add a plugin to handle the html if it exists
			if (part !== "background" || (part == "background" && type_of_background == "html")) {
				options.plugins.push(
					new HtmlWebpackPlugin({
						template: `${extension_parts_path}/${part}/${part}.html`,
						filename: `${part}/${part}.html`,
						chunks: [part]
					})
				)
			}
		}
	}
	//DEVELOPMENT INDEX PAGE
	if (mode == "development") {
		let ejs = require("ejs")
		//add entry to output the table of content index so we
		//can quickly go to the different parts we're serving
		options.plugins.push(
			new CopyWebpackPlugin([{
				from: `${source_path}/index.ejs`,
				to: "index.html",
				transform: function(content) {
					content = content.toString()
					content = ejs.render(content, {
						env: env,
						parts: parts,
						type_of_background: type_of_background
					})
					return content
				}
			}])
		)
	}
	//WEBPACK OPTIONS
	options = {
		//copy the options we set above
		...options,
		watch: mode == "development" ? true : false,
		output: {
			path: path.join(__dirname, build_path),
			// publicPath: path.join(__dirname, build_path),
			publicPath: "/",
			filename: "[name].js",
		},
		//turns off the annoying bundle size warnings
		performance: {
			hints: false
		},
		devServer: {
			clientLogLevel: "warning",
			contentBase: build_path,
			hot: true,
			host: "localhost",
			port: port || "8080",
			stats: "errors-only",
		},
		devtool: "source-map", //so we can run extensions in chrome (default option uses eval which will give csp error in chrome)
		module: {
			rules: [
				{
					test: /\.html$/,
					loader: "vue-html-loader",
					exclude: /node_modules/
				},
				{
					//if order needs to change be sure to also change the index
					//when we change options.module.rules at the end
					test: /\.js$/,
					use: [ //dev loader spliced in later
						
						{
							loader: "babel-loader"
						},
						{
							loader: "eslint-loader",
							options: eslint_config,
						},
					],
					exclude: /node_modules/
				},
				{
					test: /\.vue$/,
					use: [
						{
							loader: "vue-loader"
						},
						{
							loader: "eslint-loader",
							options: eslint_config,
						},
					]
				},
				//HANDLE CSS
				{
					test: /\.css$/,
					loaders: ["style-loader", "css-loader"], 
					exclude: /node_modules/
				},
				{
					test: /\.scss$/,
					use: [
						"vue-style-loader",
						"css-loader",
						"sass-loader"
					],
					exclude: [path.resolve(__dirname, `${extension_parts_path}/content_scripts`)]
				},
				{
					test: /\.sass$/,
					use: [
						"vue-style-loader",
						"css-loader",
						"sass-loader?indentedSyntax"
					],
					exclude: [path.resolve(__dirname, `${extension_parts_path}/content_scripts`)]
				},
				//extract css content scripts
				{
					test: /\.scss$/,
					use: [
						MiniCssExtractPlugin.loader,
						"css-loader",
						"sass-loader"
					],
					include: [path.resolve(__dirname, `${extension_parts_path}/content_scripts`)]
				},
				{
					test: /\.sass$/,
					use: [
						MiniCssExtractPlugin.loader,
						"css-loader",
						"sass-loader?indentedSyntax"
					],
					include: [path.resolve(__dirname, `${extension_parts_path}/content_scripts`)]
				},
				//HANDLE ASSETS
				{
					test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
					loader: "file-loader",
					options: {name: `${assets_dir_name}/images/[name].[ext]`},
				},
				{
					test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
					loader: "file-loader",
					options: {name: `${assets_dir_name}/media/[name].[ext]`}
				},
				{
					test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
					loader: "file-loader",
					options: {name: `${assets_dir_name}/fonts/[name].[ext]`}
				},
			]
		},
		resolve: {
			extensions: [".js", ".vue", ".json"],
			alias: {
				"vue$": "vue/dist/vue.esm.js",
				"@assets": `../../${assets_dir_name}/`,
			}
		},
		plugins: [
			...options.plugins,
			new webpack.HotModuleReplacementPlugin(),
			new MiniCssExtractPlugin({
				filename: mode !== "production" ? "[name].css" : "[name].[hash].css",
				chunkFilename: mode !== "production" ? "[id].css" : "[id].[hash].css",
			}),
			new CleanWebpackPlugin([build_path]),
			new CopyWebpackPlugin([{//NEEDS to be first before the manifest
				from: `${source_path}/${icons_dir}`,
				to: `${icons_dir}-original`,
				transform: function(content, content_path) {
					return helpers.icon_handler(content, content_path, source_path, build_path, icons_dir, icons_to_manifest)
				}
			}]),
			new CopyWebpackPlugin([{
				from: `${extension_parts_path}/manifest.json`,
				transform: function (content, content_path) {
					return helpers.manifest_configurator(content, content_path, env, port, parts, icons_dir, type_of_background, icons_to_manifest)
				}
			}]),
			new VueLoaderPlugin(),
		],
	}
	//add write to disk plugin if not using server only script
	//remove development only dev blocks for production
	if (!env.server_only) {
		options.plugins.push(new WriteFilePlugin())

	}
	
	if (mode == "production") {
		//careful when adding loaders we depend on index here
		options.module.rules[1].use.splice(0, 0, {
			loader: "string-replace-loader",
			options: {
				multiple: [
					{ search: ".*<dev block>[\\s\\S]*<\/dev block>", replace: "", flags: "gm"}
				]
			}
		})
	}

	//add secrets to our aliases if file exists
	if (fs.existsSync("./secrets.json")) {
		options.resolve.alias["@secrets"] = path.resolve(__dirname, "./secrets.json")
	}

	return options
}
// module.exports = options