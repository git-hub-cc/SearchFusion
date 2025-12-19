/**
 * engines/parser/liumingye.js
 * 刘明野工具箱 (tool.liumingye.cn) 专用解析器
 */
(function (global) {
    // 确保全局引擎对象和工具函数存在
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;
    if (!utils) {
        console.error("[SearchFusion-Liumingye] Utils not found!");
        return;
    }

    // 定义解析器
    global.SearchFusionEngines.liumingye = {
        parse: function () {
            const results = [];
            const engineName = "刘明野"; // 用于创建结果对象的来源标识

            // 1. 查找所有结果项的容器
            // 页面结构中，每个结果项都是一个 a.list-item 元素
            const nodes = document.querySelectorAll('.list-grid .list-item');

            // 2. 遍历节点列表并提取信息
            nodes.forEach((node) => {
                try {
                    // 提取标题元素和摘要元素
                    const titleElem = node.querySelector('.list-title');
                    const snippetElem = node.querySelector('.list-desc');

                    // 确保关键元素存在
                    if (titleElem) {
                        // 提取标题、URL 和摘要文本
                        const title = utils.cleanText(titleElem.innerText);
                        const url = node.href;
                        const snippet = utils.cleanText(snippetElem ? snippetElem.innerText : "");

                        // 验证数据有效性，避免添加无效或不完整的条目
                        if (title && url && url.startsWith('http')) {
                            results.push(utils.createResult(title, url, snippet, engineName));
                        }
                    }
                } catch (e) {
                    // 捕获并记录解析单个条目时可能出现的错误，以保证后续条目能继续处理
                    console.error(`[SearchFusion-Liumingye] Error parsing an item:`, e, node);
                }
            });

            // 3. 返回提取到的结果数组
            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);