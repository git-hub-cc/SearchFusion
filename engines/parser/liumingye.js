/**
 * engines/parser/liumingye.js
 * 刘明野工具箱 (tool.liumingye.cn) 专用解析器
 * 针对搜索结果页面的 HTML 结构进行解析
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
            const engineName = "刘明野"; // 来源标识

            // 1. 查找结果容器
            // 页面结构特征：结果卡片位于 .list-grid 下，每个条目是一个 a.list-item
            // 参考 HTML: <a role="button" class="list-item" cid="181" href="...">
            const nodes = document.querySelectorAll('.list-grid a.list-item');

            // 2. 遍历节点列表提取信息
            nodes.forEach((node) => {
                try {
                    // 提取标题：位于 .list-title 元素内
                    // 参考 HTML: <div class="list-title text-md h-1x">盘搜 </div>
                    const titleElem = node.querySelector('.list-title');

                    // 提取链接：直接从 a.list-item 的 href 属性获取
                    const url = node.href;

                    // 提取摘要：位于 .list-desc 元素内
                    // 参考 HTML: <div class="list-desc ..."><div class="h-1x">高性能的网盘资源搜索</div></div>
                    const snippetElem = node.querySelector('.list-desc');

                    // 确保关键元素存在
                    if (titleElem && url) {
                        const title = utils.cleanText(titleElem.innerText);
                        const snippet = utils.cleanText(snippetElem ? snippetElem.innerText : "");

                        // 验证数据有效性
                        // 过滤掉无效链接（如 javascript:; 或空链接）
                        if (title && url.startsWith('http')) {
                            results.push(utils.createResult(title, url, snippet, engineName));
                        }
                    }
                } catch (e) {
                    // 捕获并记录解析单个条目时可能出现的错误，防止阻塞整个列表的解析
                    console.error(`[SearchFusion-Liumingye] Error parsing an item:`, e, node);
                }
            });

            // 3. 返回提取到的结果数组
            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);