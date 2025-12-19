/**
 * engines/parser/bing.js
 * Bing 专用解析器
 */
(function (global) {
    global.SearchFusionEngines = global.SearchFusionEngines || {};

    global.SearchFusionEngines.bing = {
        parse: function () {
            const results = [];
            const utils = global.SearchFusionUtils;

            const nodes = document.querySelectorAll('li.b_algo');

            nodes.forEach((node) => {
                try {
                    const titleElem = node.querySelector('h2 a');
                    const snippetElem = node.querySelector('.b_caption p, .b_snippet');

                    if (titleElem) {
                        const title = utils.cleanText(titleElem.innerText);
                        const url = titleElem.href;
                        const snippet = utils.cleanText(snippetElem ? snippetElem.innerText : "");

                        if (title && url.startsWith('http')) {
                            results.push(utils.createResult(title, url, snippet, 'bing'));
                        }
                    }
                } catch (e) {}
            });
            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);