/**
 * engines/parser/pansearch.js
 * PanSearch (pansearch.me) 专用解析器
 * 基于 Next.js + Tailwind CSS 的页面结构解析
 */
(function (global) {
    // 确保全局引擎对象和工具函数存在
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;

    if (!utils) {
        console.error("[SearchFusion-PanSearch] Utils not found!");
        return;
    }

    // 定义解析器
    global.SearchFusionEngines.pansearch = {
        parse: function () {
            const results = [];
            const engineName = "PanSearch"; // 来源标识

            // 1. 查找结果容器
            // PanSearch 使用 Grid 布局，卡片通常位于 main 容器内的 grid 下
            // 选择器：选取 main 内部，grid 类容器下的所有直接子 div (卡片)
            const nodes = document.querySelectorAll('main .grid > div');

            // 2. 遍历节点列表
            nodes.forEach((node) => {
                try {
                    // 核心内容区
                    const contentDiv = node.querySelector('.whitespace-pre-wrap');
                    if (!contentDiv) return;

                    // 获取完整文本内容
                    const fullText = utils.cleanText(contentDiv.innerText);

                    // 提取标题
                    // 文本格式通常为："名称：xxx 描述：xxx"
                    // 尝试提取 "名称：" 之后的内容，或者直接使用前段文本作为标题
                    let title = "";
                    const nameMatch = fullText.match(/名称[：:]\s*([^\s]+)/);
                    if (nameMatch && nameMatch[1]) {
                        title = nameMatch[1];
                    } else {
                        // 兜底：截取前 30 个字符作为标题
                        title = fullText.substring(0, 30);
                    }

                    // 提取 URL
                    // 优先寻找卡片内的链接标签 (resource-link)
                    const linkElem = contentDiv.querySelector('a.resource-link') || contentDiv.querySelector('a');
                    let url = "";

                    if (linkElem && linkElem.href) {
                        url = linkElem.href;
                    } else {
                        // 如果没有显式链接，该卡片可能只是文本展示，或者链接隐藏在点击事件中
                        // 这里我们跳过没有明确 http 链接的资源
                        return;
                    }

                    // 提取摘要
                    // 使用剩余的文本作为摘要，并移除"展开"等按钮文字
                    let snippet = fullText
                        .replace(title, '') // 去掉标题部分
                        .replace(/名称[：:]/, '')
                        .replace(/展开/, '')
                        .replace(/链接[：:]/, '')
                        .trim();

                    // 获取发布时间作为辅助信息
                    const timeElem = node.querySelector('.text-base-content\\/70');
                    if (timeElem) {
                        snippet = `[${utils.cleanText(timeElem.innerText)}] ` + snippet;
                    }

                    // 验证数据有效性
                    if (title && url && url.startsWith('http')) {
                        results.push(utils.createResult(title, url, snippet, engineName));
                    }

                } catch (e) {
                    console.error(`[SearchFusion-PanSearch] Error parsing an item:`, e, node);
                }
            });

            // 3. 返回结果
            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);