/**
 * engines/parser/cinematerial.js
 * CineMaterial (cinematerial.com) 专用解析器
 */
(function (global) {
    // 确保全局引擎对象和工具函数存在
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;

    if (!utils) {
        console.error("[SearchFusion-CineMaterial] Utils not found!");
        return;
    }

    // 定义解析器
    global.SearchFusionEngines.cinematerial = {
        parse: function () {
            const results = [];
            const engineName = "CineMaterial";

            // 结果以表格形式展示，每一行 `<tr>` 代表一个条目
            const nodes = document.querySelectorAll('main div.table-responsive table tr');

            nodes.forEach((node) => {
                try {
                    // 核心信息位于第二个 `<td>` 单元格中
                    const infoCell = node.querySelector('td:nth-child(2)');
                    if (!infoCell) return;

                    // 提取标题和链接
                    const linkElem = infoCell.querySelector('a.font-bold');
                    if (!linkElem) return;

                    const title = utils.cleanText(linkElem.innerText);
                    let url = linkElem.getAttribute('href');

                    // 补全相对 URL
                    if (url && url.startsWith('/')) {
                        url = window.location.origin + url;
                    }
                    if (!title || !url || !url.startsWith('http')) return;

                    // --- 构建摘要信息 ---
                    const snippetParts = [];

                    // 1. 提取年份
                    const yearElem = infoCell.querySelector('strong.text-gray-400');
                    if (yearElem) {
                        snippetParts.push(`[年份: ${utils.cleanText(yearElem.innerText)}]`);
                    }

                    // 2. 提取演员/描述信息
                    const descElem = infoCell.querySelector('span.block.text-gray-400');
                    if (descElem) {
                        const description = utils.cleanText(descElem.innerText);
                        // 过滤掉纯粹的 "Poster artist" 描述
                        if (description.toLowerCase() !== 'poster artist') {
                            snippetParts.push(description);
                        }
                    }

                    const snippet = snippetParts.join(' ');

                    results.push(utils.createResult(title, url, snippet, engineName));

                } catch (e) {
                    console.error('[SearchFusion-CineMaterial] Error parsing an item:', e, node);
                }
            });

            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);