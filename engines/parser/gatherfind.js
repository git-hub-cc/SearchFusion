/**
 * engines/parser/gatherfind.js
 * GF发现 (www.gatherfind.com) 专用解析器
 */
(function (global) {
    // 确保全局引擎对象和工具函数存在
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;
    if (!utils) {
        console.error("[SearchFusion-Gatherfind] Utils not found!");
        return;
    }

    // 定义解析器
    global.SearchFusionEngines.gatherfind = {
        parse: function () {
            const results = [];
            const engineName = "gatherfind"; // 来源标识

            // 1. 查找所有结果项的容器
            // 搜索结果被包裹在 `.searchbox` 容器内的 `<p>` 标签中
            const nodes = document.querySelectorAll('.searchbox p');

            // 2. 遍历节点列表
            nodes.forEach((node) => {
                try {
                    // 每个 <p> 标签包含一个标题链接 <a> 和一个摘要文本
                    // 链接和摘要都在 <p> 的直接子节点中
                    const linkElem = node.querySelector('a');

                    if (linkElem) {
                        const title = utils.cleanText(linkElem.innerText);
                        const url = linkElem.href;

                        // 提取摘要：移除<a>标签后，剩余的文本就是摘要
                        // 创建一个<p>的克隆以避免修改原始DOM
                        const pClone = node.cloneNode(true);
                        const linkInClone = pClone.querySelector('a');
                        if(linkInClone) {
                            linkInClone.remove(); // 移除链接
                        }
                        // 剩余的文本就是摘要，清理掉多余的 <br> 和空格
                        const snippet = utils.cleanText(pClone.textContent.replace(/https?:\/\/[^\s]+/g, ''));


                        // 验证数据有效性
                        if (title && url && url.startsWith('http')) {
                            results.push(utils.createResult(title, url, snippet, engineName));
                        }
                    }
                } catch (e) {
                    // 捕获并记录解析单个条目时可能出现的错误
                    console.error(`[SearchFusion-Gatherfind] Error parsing an item:`, e, node);
                }
            });

            // 3. 返回结果
            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);