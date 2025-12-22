/**
 * engines/parser/anime1.js
 * Anime1 (anime1.cc) 专用解析器
 * 针对搜索结果页面的 HTML 结构进行解析。
 */
(function (global) {
    // 确保全局引擎对象和工具函数存在
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;
    if (!utils) {
        console.error("[SearchFusion-Anime1] Utils not found!");
        return;
    }

    // 定义解析器
    global.SearchFusionEngines.anime1 = {
        parse: function () {
            const results = [];
            const engineName = "anime1"; // 来源标识

            // 1. 查找所有结果项的容器
            // 搜索结果项的类名为 .table-item
            const nodes = document.querySelectorAll('.table-pane .table-item');

            // 2. 遍历节点列表提取信息
            nodes.forEach((node) => {
                try {
                    // 链接包裹整个卡片
                    const linkElem = node.querySelector('a');
                    if (!linkElem) return;

                    const url = linkElem.href;

                    // 提取标题
                    const titleElem = linkElem.querySelector('.title');
                    const title = utils.cleanText(titleElem ? titleElem.innerText : "");

                    if (!title || !url || !url.startsWith('http')) return;

                    // 提取摘要信息，拼接成年份、其他名字等
                    const snippetParts = [];
                    const infoDivs = linkElem.querySelectorAll('div:not(.title)');

                    infoDivs.forEach(div => {
                        const text = utils.cleanText(div.innerText);
                        // 清理文本并只保留有价值的信息
                        if (text && !text.toLowerCase().includes('来源')) {
                            snippetParts.push(text.replace(':', ': '));
                        }
                    });

                    const snippet = snippetParts.join(' | ');

                    results.push(utils.createResult(title, url, snippet, engineName));

                } catch (e) {
                    console.error(`[SearchFusion-Anime1] Error parsing an item:`, e, node);
                }
            });

            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);