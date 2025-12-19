/**
 * engines/parser/google.js
 * Google 专用解析器
 */
(function (global) {
    global.SearchFusionEngines = global.SearchFusionEngines || {};

    global.SearchFusionEngines.google = {
        parse: function () {
            const results = [];
            const utils = global.SearchFusionUtils;

            // 选择器覆盖新旧版本 Google 页面结构
            const nodes = document.querySelectorAll('div.g, div.tF2Cxc, div.mnr-c');

            nodes.forEach((node) => {
                try {
                    if (node.closest('.g-blk')) return; // 排除干扰项

                    const titleElem = node.querySelector('h3');
                    const linkElem = node.querySelector('a');

                    // 摘要通常在这些容器中
                    const snippetElem = node.querySelector('div.VwiC3b, span.aCOpRe, div.IsZvec');

                    if (titleElem && linkElem) {
                        const title = utils.cleanText(titleElem.innerText);
                        const url = linkElem.href;
                        const snippet = utils.cleanText(snippetElem ? snippetElem.innerText : "");

                        if (title && url.startsWith('http')) {
                            results.push(utils.createResult(title, url, snippet, 'google'));
                        }
                    }
                } catch (e) {}
            });
            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);