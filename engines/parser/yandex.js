/**
 * engines/parser/yandex.js
 * Yandex 专用解析器
 * 针对 Yandex.com / Yandex.ru 搜索结果页面的 DOM 结构进行解析
 */
(function (global) {
    // 确保全局引擎对象和工具函数存在
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;

    if (!utils) {
        console.error("[SearchFusion-Yandex] Utils not found!");
        return;
    }

    // 定义解析器
    global.SearchFusionEngines.yandex = {
        parse: function () {
            const results = [];
            const engineName = "yandex"; // 来源标识

            // 1. 查找所有结果项的容器
            // 根据提供的 HTML 样本，Yandex 的主要结果项包裹在 li.serp-item 中
            const nodes = document.querySelectorAll('li.serp-item');

            // 2. 遍历节点列表
            nodes.forEach((node) => {
                try {
                    // 确保这是一个有机的搜索结果（通常包含 .Organic 类）
                    // 忽略 purely decorative 或其他类型的卡片
                    const organicContainer = node.querySelector('.Organic, .organic');
                    if (!organicContainer) {
                        return;
                    }

                    // 提取标题元素 (a.OrganicTitle-Link)
                    const linkElem = node.querySelector('a.OrganicTitle-Link');

                    if (linkElem) {
                        // 尝试从特定的 span 中获取标题文本，如果不存在则使用链接的直接文本
                        const titleSpan = linkElem.querySelector('.OrganicTitleContentSpan') || linkElem.querySelector('.organic__title');
                        const title = utils.cleanText(titleSpan ? titleSpan.innerText : linkElem.innerText);
                        const url = linkElem.href;

                        // 提取摘要
                        // 摘要通常位于 .OrganicTextContentSpan 或 .organic__text 容器内
                        const snippetElem = node.querySelector('.OrganicTextContentSpan') ||
                            node.querySelector('.OrganicText') ||
                            node.querySelector('.organic__text');

                        const snippet = utils.cleanText(snippetElem ? snippetElem.innerText : "");

                        // 验证数据有效性
                        if (title && url && url.startsWith('http')) {
                            results.push(utils.createResult(title, url, snippet, engineName));
                        }
                    }
                } catch (e) {
                    // 捕获并记录解析单个条目时可能出现的错误
                    console.error(`[SearchFusion-Yandex] Error parsing an item:`, e, node);
                }
            });

            // 3. 返回结果
            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);