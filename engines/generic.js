/**
 * engines/generic.js
 * 通用 DOM 解析器
 * 适用于大多数标准的搜索结果页面结构
 */
(function (global) {
    global.SearchFusionEngines = global.SearchFusionEngines || {};

    global.SearchFusionEngines.generic = {
        /**
         * 尝试解析通用页面结构
         * 原理：查找包含大量链接的列表容器，提取标题和摘要
         */
        parse: function () {
            const results = [];
            const utils = global.SearchFusionUtils;

            // 1. 定义常见的搜索结果容器选择器
            // 优先级从高到低
            const potentialSelectors = [
                '.result-list', '.search-results', '.list-view', // 语义化类名
                'div[class*="result"]', 'div[class*="list"]',    // 模糊匹配
                'article', 'li'                                  // 基础标签
            ];

            // 2. 尝试寻找列表项
            // 这里使用简化的逻辑：查找页面中主要的内容区域
            const mainContent = document.querySelector('main') ||
                document.querySelector('#content') ||
                document.querySelector('#container') ||
                document.body;

            if (!mainContent) return [];

            // 查找所有可能的链接块
            // 假设搜索结果通常是 h2, h3, h4 包裹的 a 标签
            const linkNodes = mainContent.querySelectorAll('h2 a, h3 a, h4 a, .title a');

            linkNodes.forEach(link => {
                try {
                    const title = utils.cleanText(link.innerText);
                    const url = link.href;

                    if (!title || !url || url.startsWith('javascript:')) return;
                    if (title.length < 2) return; // 过滤太短的标题

                    // 尝试寻找摘要
                    // 向上找父级容器，再在父级容器中找 p 或 span
                    const parent = link.closest('li') || link.closest('div') || link.parentElement;
                    let snippet = "";

                    if (parent) {
                        // 排除标题自身，提取剩余文本
                        const clone = parent.cloneNode(true);
                        const titleInClone = clone.querySelector('h2 a, h3 a, h4 a, .title a');
                        if (titleInClone) titleInClone.remove();
                        snippet = utils.cleanText(clone.innerText);

                        // 截取适当长度
                        if (snippet.length > 200) snippet = snippet.substring(0, 200) + '...';
                    }

                    results.push(utils.createResult(title, url, snippet, 'generic'));

                } catch (e) {
                    // 忽略解析错误的单项
                }
            });

            // 简单去重
            const uniqueResults = [];
            const seenUrls = new Set();
            results.forEach(r => {
                if (!seenUrls.has(r.url)) {
                    seenUrls.add(r.url);
                    uniqueResults.push(r);
                }
            });

            return uniqueResults;
        }
    };
})(typeof window !== "undefined" ? window : this);