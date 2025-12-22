/**
 * engines/parser/gimy.js
 * Gimy TV (gimytv.ai) 专用解析器
 */
(function (global) {
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;

    if (!utils) {
        console.error("[SearchFusion-Gimy] Utils not found!");
        return;
    }

    global.SearchFusionEngines.gimy = {
        parse: function () {
            const results = [];
            const engineName = "Gimy TV";

            const nodes = document.querySelectorAll('.details-info-min');

            nodes.forEach((node) => {
                try {
                    const linkElem = node.querySelector('.details-info ul li:first-child a');
                    if (!linkElem) return;

                    const title = utils.cleanText(linkElem.innerText);
                    let url = linkElem.getAttribute('href');

                    if (url && url.startsWith('/')) {
                        url = window.location.origin + url;
                    }
                    if (!title || !url || !url.startsWith('http')) return;

                    // --- 构建摘要 ---
                    const snippetParts = [];

                    const statusElem = node.querySelector('.details-info ul li:first-child span.hidden-sm');
                    if (statusElem) {
                        snippetParts.push(`[${utils.cleanText(statusElem.innerText)}]`);
                    }

                    const infoItems = node.querySelectorAll('.details-info ul li.text');
                    infoItems.forEach(item => {
                        const itemText = utils.cleanText(item.innerText);
                        if (itemText.startsWith('類型：')) {
                            snippetParts.push(itemText.replace('類型：', '類型: '));
                        } else if (itemText.startsWith('主演：')) {
                            let actors = itemText.replace('主演：', '').trim();
                            if (actors.length > 100) actors = actors.substring(0, 100) + '...';
                            snippetParts.push(`主演: ${actors}`);
                        } else if (itemText.startsWith('年代：')) {
                            snippetParts.push(itemText.replace('年代：', '年份: '));
                        }
                    });

                    const snippet = snippetParts.join(' | ');

                    results.push(utils.createResult(title, url, snippet, engineName));

                } catch (e) {
                    console.error(`[SearchFusion-Gimy] Error parsing an item:`, e, node);
                }
            });

            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);