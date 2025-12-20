/**
 * engines/parser/xiaoyu.js
 * 小宇搜索 (xykmovie.com) 专用解析器
 * 针对该站点特殊的 Base64 编码链接和数据属性结构进行解析
 */
(function (global) {
    // 确保全局引擎对象和工具函数存在
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;

    if (!utils) {
        console.error("[SearchFusion-Xiaoyu] Utils not found!");
        return;
    }

    // 定义解析器
    global.SearchFusionEngines.xiaoyu = {
        parse: function () {
            const results = [];
            const engineName = "小宇搜索"; // 来源标识

            // 1. 查找结果容器
            // 结果项位于 .search-list 下的 .item 元素中
            const nodes = document.querySelectorAll('#Search-item .item');

            // 2. 遍历节点列表
            nodes.forEach((node) => {
                try {
                    // 核心链接元素，包含 data-url 和 data-code
                    const linkElem = node.querySelector('a.open');
                    if (!linkElem) return;

                    // 提取标题
                    const title = utils.cleanText(linkElem.innerText);

                    // 提取并解码 URL
                    // 该站点将真实链接 Base64 编码后存储在 data-url 属性中
                    // 部分链接可能没有 http 前缀，需要补全
                    let url = "";
                    const encodedUrl = linkElem.getAttribute('data-url');

                    if (encodedUrl) {
                        try {
                            // Base64 解码
                            const decoded = atob(encodedUrl);
                            // 检查解码后的链接是否以 http 开头，如果不是（如 pan.baidu.com...），则补全协议
                            if (decoded.startsWith('http')) {
                                url = decoded;
                            } else {
                                url = 'https://' + decoded;
                            }
                        } catch (err) {
                            console.warn("[SearchFusion-Xiaoyu] Base64 decode failed:", encodedUrl);
                        }
                    }

                    // 如果 Base64 解码失败或为空，尝试 fallback 到 href (虽然通常是 javascript:;)
                    if (!url && linkElem.href && linkElem.href.startsWith('http')) {
                        url = linkElem.href;
                    }

                    // 提取摘要
                    // 摘要分散在多个 .atips 元素中
                    // 我们合并提取时间、提取码、以及内容描述
                    let snippetParts = [];
                    const atips = node.querySelectorAll('.atips a');

                    atips.forEach(tip => {
                        const text = utils.cleanText(tip.innerText);
                        // 过滤掉提示语，保留有价值的信息
                        if (!text.includes("温馨提示") && !text.includes("点击上方剧名")) {
                            snippetParts.push(text);
                        }
                    });

                    // 尝试提取提取码 (data-code)
                    const code = linkElem.getAttribute('data-code');
                    if (code && code.trim()) {
                        snippetParts.unshift(`[提取码: ${code.trim()}]`);
                    }

                    const snippet = snippetParts.join(' | ');

                    // 验证数据有效性
                    if (title && url) {
                        results.push(utils.createResult(title, url, snippet, engineName));
                    }

                } catch (e) {
                    console.error(`[SearchFusion-Xiaoyu] Error parsing an item:`, e, node);
                }
            });

            // 3. 返回结果
            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);