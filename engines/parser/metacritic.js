/**
 * engines/parser/metacritic.js
 * Metacritic (metacritic.com) 专用解析器
 */
(function (global) {
    // 确保全局引擎对象和工具函数存在
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;

    if (!utils) {
        console.error("[SearchFusion-Metacritic] Utils not found!");
        return;
    }

    global.SearchFusionEngines.metacritic = {
        parse: function () {
            const results = [];
            const engineName = "Metacritic";

            // 结果项使用 data-testid 属性，是稳定的选择器
            const nodes = document.querySelectorAll('a[data-testid="search-result-item"]');

            nodes.forEach((node) => {
                try {
                    // 提取标题
                    const titleElem = node.querySelector('p[data-testid="product-title"]');
                    if (!titleElem) return;

                    const title = utils.cleanText(titleElem.innerText);
                    let url = node.getAttribute('href');

                    // 补全相对 URL
                    if (url && url.startsWith('/')) {
                        url = window.location.origin + url;
                    }
                    if (!title || !url || !url.startsWith('http')) return;

                    // --- 构建摘要信息 ---
                    const snippetParts = [];

                    // 1. 提取 Metascore
                    const scoreElem = node.querySelector('[data-testid="product-metascore"] > div');
                    if (scoreElem) {
                        const score = utils.cleanText(scoreElem.innerText);
                        // tbd 表示暂无评分
                        if (score.toLowerCase() !== 'tbd') {
                            let scoreIcon = ' M ';
                            // 根据评分颜色添加图标
                            if (scoreElem.classList.contains('c-siteReviewScore_green')) {
                                scoreIcon = '🟩 ';
                            } else if (scoreElem.classList.contains('c-siteReviewScore_yellow')) {
                                scoreIcon = '🟨 ';
                            } else if (scoreElem.classList.contains('c-siteReviewScore_red')) {
                                scoreIcon = '🟥 ';
                            }
                            snippetParts.push(`[Metascore: ${scoreIcon}${score}]`);
                        }
                    }

                    // 2. 提取元数据 (发布日期、平台)
                    const metaElem = node.querySelector('[data-testid="product-metadata"]');
                    if (metaElem) {
                        const metaText = utils.cleanText(metaElem.innerText).replace(/•/g, '|');
                        snippetParts.push(metaText);
                    }

                    const snippet = snippetParts.join(' ');

                    results.push(utils.createResult(title, url, snippet, engineName));

                } catch (e) {
                    console.error('[SearchFusion-Metacritic] Error parsing an item:', e, node);
                }
            });

            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);