/**
 * engines/parser/upyunso.js
 * up云搜 (upyunso.com) 专用解析器
 * 针对该网站特殊的 JavaScript 链接跳转机制进行适配
 */
(function (global) {
    // 确保全局引擎对象和工具函数存在
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;

    if (!utils) {
        console.error("[SearchFusion-UpYunSo] Utils not found!");
        return;
    }

    // 定义解析器
    global.SearchFusionEngines.upyunso = {
        parse: function () {
            const results = [];
            const engineName = "up云搜"; // 来源标识

            // 1. 查找结果容器
            // 页面结构：.search-results-list > .result-item
            const nodes = document.querySelectorAll('.search-results-list .result-item');

            // 2. 遍历节点列表
            nodes.forEach((node) => {
                try {
                    // 提取标题区域
                    const titleElem = node.querySelector('.item-title a');
                    if (!titleElem) return;

                    const title = utils.cleanText(titleElem.innerText);

                    // 提取摘要信息（通常包含更新时间和来源图标）
                    const infoElem = node.querySelector('.item-info');
                    const snippet = utils.cleanText(infoElem ? infoElem.innerText : "");

                    // 3. 处理 URL (难点)
                    // 该网站使用 onclick="Upso.handleUrlAction('HASH', 'open')" 进行跳转
                    // 且 href 为 javascript:void(0);
                    // 为了让插件能打开有效链接，我们需要构造一个唯一的 URL
                    // 策略：提取 onclick 中的 hash，构造锚点链接指向当前页，让用户手动点击（或后续支持深层解析）
                    let url = "";
                    const onclickText = titleElem.getAttribute('onclick');

                    if (onclickText) {
                        // 正则提取 Hash 值: handleUrlAction('HASH',
                        const match = onclickText.match(/handleUrlAction\(['"]([^'"]+)['"]/);
                        if (match && match[1]) {
                            // 构造一个带有 Hash 的唯一链接，防止插件去重时被误删
                            // 注意：这只是为了通过插件的有效性检查，实际上可能无法直接跳转到资源
                            // 用户点击后会跳回原网页，这也是目前无侵入式脚本能做到的最好降级方案
                            url = window.location.href.split('#')[0] + "#file-" + match[1];
                        }
                    }

                    // 如果没提取到 hash，则使用带有随机数的链接兜底
                    if (!url) {
                        url = window.location.href + "#index-" + Math.random().toString(36).substr(2, 9);
                    }

                    // 验证数据有效性
                    if (title) {
                        results.push(utils.createResult(title, url, snippet, engineName));
                    }

                } catch (e) {
                    console.error(`[SearchFusion-UpYunSo] Error parsing an item:`, e, node);
                }
            });

            // 3. 返回结果
            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);