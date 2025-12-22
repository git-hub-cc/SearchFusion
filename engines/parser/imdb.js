/**
 * engines/parser/imdb.js
 * IMDb (imdb.com) 专用解析器
 */
(function (global) {
    // 确保全局引擎对象和工具函数存在
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;
    if (!utils) {
        console.error("[SearchFusion-IMDb] Utils not found!");
        return;
    }

    global.SearchFusionEngines.imdb = {
        parse: function () {
            const results = [];
            const engineName = "IMDb";

            // 搜索结果主要分为 "Titles" (影视作品) 和 "People" (人物) 等板块
            // 我们专注于提取 "Titles" 板块的结果
            // 选择器定位到 "Titles" section 下的所有列表项
            const nodes = document.querySelectorAll('section[data-testid="find-results-section-title"] ul > li');

            nodes.forEach((node) => {
                try {
                    // 查找标题和链接元素
                    const linkElem = node.querySelector('a.ipc-title-link-wrapper');
                    const titleElem = linkElem ? linkElem.querySelector('h3.ipc-title__text') : null;

                    if (!titleElem || !linkElem) return;

                    const title = utils.cleanText(titleElem.innerText);
                    let url = linkElem.getAttribute('href');

                    if (!title || !url) return;

                    // 补全相对 URL 为绝对路径
                    if (url.startsWith('/')) {
                        url = window.location.origin + url;
                    }
                    if (!url.startsWith('http')) return;

                    // --- 构建摘要信息 ---
                    const snippetParts = [];

                    // 1. 提取元数据 (年份, 时长, 分级)
                    const metadataElems = node.querySelectorAll('.cli-title-metadata-item');
                    metadataElems.forEach(elem => {
                        const text = utils.cleanText(elem.innerText);
                        if (text) snippetParts.push(text);
                    });

                    // 2. 提取 IMDb 评分和投票数
                    const ratingElem = node.querySelector('.ipc-rating-star--rating');
                    const voteCountElem = node.querySelector('.ipc-rating-star--voteCount');
                    if (ratingElem) {
                        const rating = utils.cleanText(ratingElem.innerText);
                        const voteCountText = voteCountElem ? utils.cleanText(voteCountElem.innerText) : '';
                        snippetParts.push(`[评分: ${rating} ${voteCountText}]`);
                    }

                    // 3. 提取 Metascore
                    const metascoreElem = node.querySelector('.metacritic-score-box');
                    if (metascoreElem) {
                        snippetParts.push(`[Metascore: ${utils.cleanText(metascoreElem.innerText)}]`);
                    }

                    // 4. 提取剧情简介
                    const plotElem = node.querySelector('.ipc-html-content-inner-div');
                    if (plotElem) {
                        snippetParts.push(utils.cleanText(plotElem.innerText));
                    }

                    const snippet = snippetParts.join(' | ');

                    results.push(utils.createResult(title, url, snippet, engineName));

                } catch (e) {
                    console.error('[SearchFusion-IMDb] Error parsing an item:', e, node);
                }
            });

            // 简单去重，以防页面结构变动导致重复抓取
            const uniqueResults = [];
            const seenUrls = new Set();
            results.forEach(r => {
                if (r && r.url && !seenUrls.has(r.url)) {
                    seenUrls.add(r.url);
                    uniqueResults.push(r);
                }
            });

            return uniqueResults;
        }
    };
})(typeof window !== "undefined" ? window : this);