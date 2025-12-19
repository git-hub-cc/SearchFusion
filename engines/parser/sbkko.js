/**
 * engines/parser/sbkko.js
 * SBKKO导航 (nav.sbkko.com) 专用解析器
 */
(function (global) {
    // 确保全局引擎对象和工具函数存在
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;
    if (!utils) {
        console.error("[SearchFusion-Sbkko] Utils not found!");
        return;
    }

    // 定义解析器
    global.SearchFusionEngines.sbkko = {
        parse: function () {
            const results = [];
            const engineName = "SBKKO"; // 来源标识

            // 1. 查找所有结果项的容器
            // 每个结果项是 `article.sites-item` 元素
            const nodes = document.querySelectorAll('article.sites-item');

            // 2. 遍历节点列表
            nodes.forEach((node) => {
                try {
                    // 结果链接包裹在 `a.sites-body` 元素中
                    const linkElem = node.querySelector('a.sites-body');

                    if (linkElem) {
                        // 提取标题、URL和摘要
                        const titleElem = linkElem.querySelector('.item-title b');
                        const snippetElem = linkElem.querySelector('.line1.text-muted');
                        const url = linkElem.href; // 详情页链接

                        // 验证数据有效性
                        if (titleElem && url) {
                            const title = utils.cleanText(titleElem.innerText);
                            const snippet = utils.cleanText(snippetElem ? snippetElem.innerText : "");

                            if (title && url.startsWith('http')) {
                                results.push(utils.createResult(title, url, snippet, engineName));
                            }
                        }
                    }
                } catch (e) {
                    // 捕获并记录解析单个条目时可能出现的错误
                    console.error(`[SearchFusion-Sbkko] Error parsing an item:`, e, node);
                }
            });

            // 3. 返回结果
            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);