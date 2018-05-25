// https://eslint.org/docs/user-guide/configuring

let base = require("eslint-plugin-vue/lib/configs/base.js").rules
let reccomended = require("eslint-plugin-vue/lib/configs/recommended.js").rules

module.exports = {
   root: true,
   parserOptions: {
      parser: "babel-eslint"
   },
   env: {
      browser: true,
   },
   plugins: [
      "vue"
   ],
   extends:["plugin:vue/base"],
   rules: {
      "no-debugger": process.env.NODE_ENV === "production" ? 2 : 0,
		"indent": ["error", "tab", {"SwitchCase":1}],
      "quotes": [
         "error",
         "double"
      ],
      "semi": [
         "error",
         "never"
      ],
      //temporary undo vue base extend, is redone in overrides just for vue files
      "vue/comment-directive": "off",
      "vue/jsx-uses-vars": "off"
   },
   overrides: [
      {
         files: [ "src/*.vue", ],
         rules: Object.assign(base, reccomended, //hack to just lint vue files with vue rules until eslint supports override extends
         {
            "vue/html-closing-bracket-newline": ["error", {
               "singleline": "never",
               "multiline": "always"
            }],
            //https://github.com/vuejs/eslint-plugin-vue/blob/HEAD/docs/rules/require-default-prop.md
            "vue/require-default-prop":"off",
            //https://github.com/vuejs/eslint-plugin-vue/blob/HEAD/docs/rules/require-prop-types.md
            "vue/require-prop-types":"off",
            //https://github.com/vuejs/eslint-plugin-vue/blob/HEAD/docs/rules/name-property-casing.md
            "vue/name-property-casing": ["error", "kebab-case"],
            // https://github.com/vuejs/eslint-plugin-vue/blob/HEAD/docs/rules/max-attributes-per-line.md
            "vue/max-attributes-per-line": [2, {
               "singleline": 3,
               "multiline": {
                  "max": 1,
                  "allowFirstLine": false
               }
            }],
            //https://github.com/vuejs/eslint-plugin-vue/blob/HEAD/docs/rules/script-indent.md
            'vue/script-indent': ['error', "tab", {
               'baseIndent': 0,
               'switchCase': 1,
               'ignores': []
            }],
            //https://github.com/vuejs/eslint-plugin-vue/blob/master/docs/rules/html-indent.md
            "vue/html-indent": ["error", "tab", {
               "attribute": 1,
               "closeBracket": 0,
               "alignAttributesVertically": true,
               "ignores": []
            }],
         }),
      }
   ]
}
