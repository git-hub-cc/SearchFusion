/**
 * engines/parser/yueyu2.js
 * 爱港剧 (www.yueyu2.com) 专用解析器
 * 针对其名为 'mxtheme' 的主题卡片结构进行解析。
 */
(function (global) {
    // 确保全局引擎对象和工具函数存在
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;
    if (!utils) {
        console.error("[SearchFusion-Yueyu2] Utils not found!");
        return;
    }

    // 定义解析器
    global.SearchFusionEngines.yueyu2 = {
        parse: function () {
            const results = [];
            const engineName = "爱港剧"; // 来源标识

            // 1. 查找所有结果项的容器
            // 每个结果卡片由 .module-card-item.module-item 类标识
            const nodes = document.querySelectorAll('.module-card-item.module-item');

            // 2. 遍历节点列表提取信息
            nodes.forEach((node) => {
                try {
                    // 提取标题和链接
                    const titleElem = node.querySelector('.module-card-item-title a strong');
                    // 链接可以在标题上，也可以在海报图上
                    const linkElem = node.querySelector('.module-card-item-poster');

                    if (!titleElem || !linkElem) return;

                    const title = utils.cleanText(titleElem.innerText);
                    let url = linkElem.href;

                    // 补全相对 URL
                    if (url && url.startsWith('/')) {
                        url = window.location.origin + url;
                    }

                    // 提取摘要信息
                    const snippetParts = [];

                    // a. 提取类型 (如: "电影")
                    const classElem = node.querySelector('.module-card-item-class');
                    if (classElem) {
                        snippetParts.push(`[${utils.cleanText(classElem.innerText)}]`);
                    }

                    // b. 提取更新状态 (如: "已完结" 或 "02")
                    const noteElem = node.querySelector('.module-item-note');
                    if (noteElem) {
                        snippetParts.push(`[${utils.cleanText(noteElem.innerText)}]`);
                    }

                    // c. 提取元数据 (年份/地区/类型)
                    const metaElem = node.querySelector('.module-info-item:nth-child(1) .module-info-item-content');
                    if (metaElem) {
                        const metaText = utils.cleanText(metaElem.innerText).replace(/\s\/\s/g, ' | ');
                        snippetParts.push(metaText);
                    }

                    // d. 提取主演信息 (截断过长的列表)
                    const actorsElem = node.querySelector('.module-info-item:nth-child(2) .module-info-item-content');
                    if (actorsElem) {
                        let actorsText = utils.cleanText(actorsElem.innerText);
                        if (actorsText.length > 100) {
                            actorsText = actorsText.substring(0, 100) + '...';
                        }
                        if (actorsText) snippetParts.push(`主演: ${actorsText}`);
                    }

                    const snippet = snippetParts.join(' ');

                    // 验证数据有效性
                    if (title && url && url.startsWith('http')) {
                        results.push(utils.createResult(title, url, snippet, engineName));
                    }
                } catch (e) {
                    // 捕获并记录解析单个条目时可能出现的错误
                    console.error(`[SearchFusion-Yueyu2] Error parsing an item:`, e, node);
                }
            });

            // 3. 返回提取到的结果数组
            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);