/**
 * engines/parser/nivod.js
 * 泥视频 (nivod.vip) 专用解析器
 */
(function (global) {
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;

    if (!utils) {
        console.error("[SearchFusion-Nivod] Utils not found!");
        return;
    }

    global.SearchFusionEngines.nivod = {
        parse: function () {
            const results = [];
            const engineName = "泥视频";

            const nodes = document.querySelectorAll('.module-card-item.module-item');

            nodes.forEach((node) => {
                try {
                    const linkElem = node.querySelector('.module-card-item-title a');
                    const titleElem = linkElem ? linkElem.querySelector('strong') : null;

                    if (!linkElem || !titleElem) return;

                    const title = utils.cleanText(titleElem.innerText);
                    let url = linkElem.href;

                    if (url && url.startsWith('/')) {
                        url = window.location.origin + url;
                    }
                    if (!title || !url || !url.startsWith('http')) return;

                    // --- 构建摘要 ---
                    const snippetParts = [];

                    const noteElem = node.querySelector('.module-item-note');
                    if (noteElem) {
                        snippetParts.push(`[${utils.cleanText(noteElem.innerText)}]`);
                    }

                    const metaElems = node.querySelectorAll('.module-info-item-content');
                    if (metaElems.length > 0) {
                        const metaText = utils.cleanText(metaElems[0].innerText).replace(/\s\/\s/g, ' | ');
                        snippetParts.push(metaText);
                    }

                    if (metaElems.length > 1) {
                        let actorsText = utils.cleanText(metaElems[1].innerText);
                        if (actorsText.length > 100) {
                            actorsText = actorsText.substring(0, 100) + '...';
                        }
                        snippetParts.push(`主演: ${actorsText}`);
                    }

                    const snippet = snippetParts.join(' ');

                    results.push(utils.createResult(title, url, snippet, engineName));

                } catch (e) {
                    console.error(`[SearchFusion-Nivod] Error parsing an item:`, e, node);
                }
            });

            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);