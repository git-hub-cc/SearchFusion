/**
 * engines/parser/dmla8.js
 * 风车动漫 (dmla8.com) 专用解析器
 * 针对该网站的搜索结果页 DOM 结构进行解析。
 */
(function (global) {
    // 确保全局引擎对象和工具函数存在
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;
    if (!utils) {
        console.error("[SearchFusion-Dmla8] Utils not found!");
        return;
    }

    // 定义解析器
    global.SearchFusionEngines.dmla8 = {
        parse: function () {
            const results = [];
            const engineName = "风车动漫"; // 来源标识

            // 1. 查找所有结果项的容器
            // 每个结果项由 .stui-vodlist__media > li 标识
            const nodes = document.querySelectorAll('.stui-vodlist__media > li');

            // 2. 遍历节点列表提取信息
            nodes.forEach((node) => {
                try {
                    // 提取标题和链接
                    const titleElem = node.querySelector('.detail .title a');
                    if (!titleElem) return;

                    const title = utils.cleanText(titleElem.innerText);
                    let url = titleElem.href;

                    // 补全相对 URL
                    if (url && url.startsWith('/')) {
                        url = window.location.origin + url;
                    }

                    // 提取摘要信息
                    const snippetParts = [];

                    // a. 提取更新状态
                    const statusElem = node.querySelector('.pic-text');
                    if (statusElem) {
                        snippetParts.push(`[${utils.cleanText(statusElem.innerText)}]`);
                    }

                    // b. 提取别名
                    const aliasElem = node.querySelector('p:nth-of-type(1)');
                    if (aliasElem && aliasElem.innerText.includes('别名')) {
                        snippetParts.push(utils.cleanText(aliasElem.innerText));
                    }

                    // c. 提取主演
                    const actorsElem = node.querySelector('p:nth-of-type(2)');
                    if (actorsElem && actorsElem.innerText.includes('主演')) {
                        snippetParts.push(utils.cleanText(actorsElem.innerText));
                    }

                    // d. 提取类型、地区、年份
                    const metaElem = node.querySelector('p.hidden-mi');
                    if (metaElem) {
                        const metaText = utils.cleanText(metaElem.innerText)
                            .replace(/\s+/g, ' ')
                            .replace(/类型：/g, '类型: ')
                            .replace(/地区：/g, ' | 地区: ')
                            .replace(/年份：/g, ' | 年份: ');
                        snippetParts.push(metaText);
                    }

                    const snippet = snippetParts.join(' ');

                    // 验证数据有效性
                    if (title && url && url.startsWith('http')) {
                        results.push(utils.createResult(title, url, snippet, engineName));
                    }
                } catch (e) {
                    // 捕获并记录解析单个条目时可能出现的错误
                    console.error(`[SearchFusion-Dmla8] Error parsing an item:`, e, node);
                }
            });

            // 3. 返回提取到的结果数组
            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);