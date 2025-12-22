/**
 * engines/parser/xusou.js
 * 许搜 (xusou.cn) 专用解析器
 * 针对该网站的搜索结果页 DOM 结构进行解析。
 */
(function (global) {
    // 确保全局引擎对象和工具函数存在
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;
    if (!utils) {
        console.error("[SearchFusion-Xusou] Utils not found!");
        return;
    }

    // 定义解析器
    global.SearchFusionEngines.xusou = {
        parse: function () {
            const results = [];
            const engineName = "许搜"; // 来源标识

            // 1. 查找所有结果项的容器
            // 每个结果项由 .item 类标识
            const nodes = document.querySelectorAll('.list .item');

            // 2. 遍历节点列表提取信息
            nodes.forEach((node) => {
                try {
                    // 提取标题和链接
                    const linkElem = node.querySelector('a.title');
                    if (!linkElem) return;

                    const title = utils.cleanText(linkElem.innerText);
                    const url = linkElem.href; // 链接是完整的

                    // 提取摘要信息
                    const snippetParts = [];

                    // a. 提取发布时间
                    const timeElem = node.querySelector('.type.time');
                    if (timeElem) {
                        snippetParts.push(`[${utils.cleanText(timeElem.innerText)}]`);
                    }

                    // b. 提取来源
                    const sourceElem = node.querySelector('.type span');
                    if (sourceElem && sourceElem.innerText.includes('来源')) {
                        snippetParts.push(`[${utils.cleanText(sourceElem.innerText)}]`);
                    }

                    const snippet = snippetParts.join(' ');

                    // 验证数据有效性
                    if (title && url && url.startsWith('http')) {
                        results.push(utils.createResult(title, url, snippet, engineName));
                    }
                } catch (e) {
                    // 捕获并记录解析单个条目时可能出现的错误
                    console.error(`[SearchFusion-Xusou] Error parsing an item:`, e, node);
                }
            });

            // 3. 返回提取到的结果数组
            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);