/**
 * engines/parser/rottentomatoes.js
 * 烂番茄 (rottentomatoes.com) 专用解析器
 */
(function (global) {
    // 确保全局引擎对象和工具函数存在
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;
    if (!utils) {
        console.error("[SearchFusion-RottenTomatoes] Utils not found!");
        return;
    }

    global.SearchFusionEngines.rottentomatoes = {
        parse: function () {
            const results = [];
            const engineName = "烂番茄";

            // 烂番茄使用 Web Components (<search-page-media-row>) 封装结果
            // 此选择器同时匹配电影和电视剧的结果行
            const nodes = document.querySelectorAll('search-page-media-row');

            nodes.forEach((node) => {
                try {
                    // 标题和链接元素位于 shadow DOM 之外的 light DOM 中，可以直接查询
                    const titleElem = node.querySelector('a[slot="title"]');
                    if (!titleElem) return;

                    const title = utils.cleanText(titleElem.innerText);
                    const url = titleElem.href; // 链接是完整的绝对路径

                    // 验证数据有效性
                    if (!title || !url || !url.startsWith('http')) return;

                    // --- 构建摘要信息 ---
                    const snippetParts = [];

                    // 1. 获取年份 (可能是 release-year, start-year, 或 end-year)
                    const year = node.getAttribute('release-year') || node.getAttribute('start-year');
                    if (year) {
                        // 对于电视剧，可能包含结束年份
                        const endYear = node.getAttribute('end-year');
                        snippetParts.push(`[年份: ${year}${endYear ? ' - ' + endYear : ''}]`);
                    }

                    // 2. 获取 Tomatometer 评分和状态
                    const score = node.getAttribute('tomatometerscore');
                    if (score && score.length > 0) {
                        const sentiment = node.getAttribute('tomatometersentiment');
                        let icon = '❓'; // 默认图标
                        if (sentiment === 'POSITIVE') icon = '🍅'; // 新鲜
                        if (sentiment === 'NEGATIVE') icon = '🤢'; // 烂
                        snippetParts.push(`[${icon} ${score}%]`);
                    }

                    // 3. 获取演职员信息
                    const cast = node.getAttribute('cast');
                    if (cast) {
                        // 截取前几位演员以保持摘要简洁
                        const castList = cast.split(',').slice(0, 3).join(', ');
                        snippetParts.push(`[主演: ${castList}]`);
                    }

                    const snippet = snippetParts.join(' ');

                    results.push(utils.createResult(title, url, snippet, engineName));

                } catch (e) {
                    console.error('[SearchFusion-RottenTomatoes] Error parsing an item:', e, node);
                }
            });

            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);