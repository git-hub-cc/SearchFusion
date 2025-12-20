/**
 * engines/parser/quark_station.js
 * 夸克小站 (pioz.cn) 专用解析器
 * 针对 Tailwind CSS 构建的文件列表页面进行解析
 */
(function (global) {
    // 确保全局引擎对象和工具函数存在
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;

    if (!utils) {
        console.error("[SearchFusion-QuarkStation] Utils not found!");
        return;
    }

    // 定义解析器
    global.SearchFusionEngines.quark_station = {
        parse: function () {
            const results = [];
            const engineName = "夸克小站"; // 来源标识

            // 1. 查找结果容器
            // 页面结构特征：列表项为 .file-item 且包含 hover 效果的 div
            const nodes = document.querySelectorAll('.file-item');

            // 2. 遍历节点列表
            nodes.forEach((node) => {
                try {
                    // 提取链接元素 (包含标题的 <a> 标签)
                    // 通常位于 .min-w-0 下的第一个 a 标签
                    const linkElem = node.querySelector('.min-w-0 > a');

                    if (linkElem) {
                        // 提取标题：优先使用 title 属性（包含完整文件名），其次使用 span 的 innerText
                        const titleSpan = linkElem.querySelector('span[title]');
                        const title = utils.cleanText(titleSpan ? titleSpan.getAttribute('title') : linkElem.innerText);

                        // 提取 URL：链接是相对路径，需要补全域名
                        let url = linkElem.getAttribute('href');
                        if (url && !url.startsWith('http')) {
                            url = window.location.origin + url;
                        }

                        // 提取摘要：包含文件类型标签、发布时间等信息
                        // 桌面端时间信息在右侧 .pl-4 容器内，移动端在 a 标签内部
                        let snippetParts = [];

                        // 提取标签 (如 "音乐", "柏林之声")
                        const tags = node.querySelectorAll('.bg-gray-700');
                        tags.forEach(tag => snippetParts.push(`[${utils.cleanText(tag.innerText)}]`));

                        // 提取时间 (格式如 "2025-10-25 22:59")
                        // 查找包含日期的文本节点，简单正则匹配
                        const timeRegex = /\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/;
                        const timeElem = Array.from(node.querySelectorAll('.text-gray-400')).find(el => timeRegex.test(el.innerText));
                        if (timeElem) {
                            snippetParts.push(utils.cleanText(timeElem.innerText));
                        }

                        const snippet = snippetParts.join(' ');

                        // 验证数据有效性
                        if (title && url) {
                            results.push(utils.createResult(title, url, snippet, engineName));
                        }
                    }
                } catch (e) {
                    console.error(`[SearchFusion-QuarkStation] Error parsing an item:`, e, node);
                }
            });

            // 3. 返回结果
            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);