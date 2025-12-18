/**
 * engines/baidu.js
 * 百度专用解析器
 */
(function (global) {
    global.SearchFusionEngines = global.SearchFusionEngines || {};

    global.SearchFusionEngines.baidu = {
        parse: function () {
            const results = [];
            const utils = global.SearchFusionUtils;

            const nodes = document.querySelectorAll('div.c-container');

            nodes.forEach((node) => {
                try {
                    const titleElem = node.querySelector('h3 a');
                    const snippetElem = node.querySelector('.c-abstract, .c-font-normal, span.content-right_8Zs40');

                    if (titleElem) {
                        const title = utils.cleanText(titleElem.innerText);
                        const url = titleElem.href;
                        const snippet = utils.cleanText(snippetElem ? snippetElem.innerText : "");

                        if (title && url.startsWith('http')) {
                            results.push(utils.createResult(title, url, snippet, 'baidu'));
                        }
                    }
                } catch (e) {}
            });
            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);