/**
 * engines/parser/bilibili.js
 * B站 (bilibili.com) 专用解析器
 * 此版本同时支持常规视频搜索和番剧/影视搜索结果。
 */
(function (global) {
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;

    if (!utils) {
        console.error("[SearchFusion-Bilibili] Utils not found!");
        return;
    }

    global.SearchFusionEngines.bilibili = {
        parse: function () {
            let results = [];

            // 优先解析番剧/影视卡片
            const pgcNodes = document.querySelectorAll('.bangumi-pgc-list .media-card');
            if (pgcNodes.length > 0) {
                results = results.concat(this.parsePgcCards(pgcNodes));
            }

            // 解析常规视频卡片
            const videoNodes = document.querySelectorAll('.video-list .bili-video-card');
            if (videoNodes.length > 0) {
                results = results.concat(this.parseVideoCards(videoNodes));
            }

            // 全局去重
            const uniqueResults = [];
            const seenUrls = new Set();
            results.forEach(r => {
                if (r && r.url && !seenUrls.has(r.url)) {
                    seenUrls.add(r.url);
                    uniqueResults.push(r);
                }
            });

            return uniqueResults;
        },

        /**
         * 解析番剧/影视卡片 (.media-card)
         */
        parsePgcCards: function(nodes) {
            const pgcResults = [];
            const engineName = "B站番剧";

            nodes.forEach((node) => {
                try {
                    const titleElem = node.querySelector('.media-card-content-head-title a');
                    if (!titleElem) return;

                    let title = utils.cleanText(titleElem.getAttribute('title') || titleElem.innerText);
                    let url = titleElem.href;

                    if (url && url.startsWith('//')) url = 'https:' + url;

                    if (!title || !url || !url.startsWith('http')) return;

                    const snippetParts = [];
                    // 类型+年份
                    const labelElem = node.querySelector('.media-card-content-head-label');
                    if (labelElem) snippetParts.push(utils.cleanText(labelElem.innerText).replace(/Â·/g, '|'));

                    // 评分
                    const scoreElem = node.querySelector('.score-value');
                    if (scoreElem) snippetParts.push(`[评分: ${utils.cleanText(scoreElem.innerText)}]`);

                    // 简介
                    const descElem = node.querySelector('.media-card-content-head-desc span');
                    if (descElem) {
                        let desc = utils.cleanText(descElem.innerText);
                        if (desc.length > 150) desc = desc.substring(0, 150) + '...';
                        snippetParts.push(desc);
                    }

                    const snippet = snippetParts.join(' ');
                    pgcResults.push(utils.createResult(title, url, snippet, engineName));

                } catch (e) {
                    console.error('[SearchFusion-Bilibili] Error parsing a PGC item:', e, node);
                }
            });
            return pgcResults;
        },

        /**
         * 解析常规视频卡片 (.bili-video-card)
         */
        parseVideoCards: function(nodes) {
            const videoResults = [];
            const engineName = "B站";

            nodes.forEach((node) => {
                try {
                    const linkElem = node.querySelector('a[href*="/video/"]');
                    const titleElem = node.querySelector('.bili-video-card__info--tit');

                    let title = utils.cleanText(titleElem ? (titleElem.getAttribute('title') || titleElem.innerText) : "");
                    if (!title) {
                        const imgElem = node.querySelector('img[alt]');
                        title = utils.cleanText(imgElem ? imgElem.getAttribute('alt') : "");
                    }

                    let url = linkElem ? linkElem.getAttribute('href') : "";
                    if (url && url.startsWith('//')) url = 'https:' + url;

                    if (!title || !url || !url.startsWith('http')) return;

                    const snippetParts = [];
                    const authorElem = node.querySelector('.bili-video-card__info--author');
                    const dateElem = node.querySelector('.bili-video-card__info--date');
                    const durationElem = node.querySelector('.bili-video-card__stats__duration');

                    const stats = node.querySelectorAll('.bili-video-card__stats--item span');
                    const views = stats[0] ? utils.cleanText(stats[0].innerText) : '';
                    const danmaku = stats[1] ? utils.cleanText(stats[1].innerText) : '';

                    if (authorElem) snippetParts.push(`[UP: ${utils.cleanText(authorElem.innerText)}]`);
                    if (dateElem) snippetParts.push(utils.cleanText(dateElem.innerText).replace(/^Â·\s*/, ''));
                    if (views) snippetParts.push(`[播放: ${views}]`);
                    if (danmaku) snippetParts.push(`[弹幕: ${danmaku}]`);
                    if (durationElem) snippetParts.push(`[时长: ${utils.cleanText(durationElem.innerText)}]`);

                    const snippet = snippetParts.join(' ');
                    videoResults.push(utils.createResult(title, url, snippet, engineName));

                } catch (e) {
                    console.error('[SearchFusion-Bilibili] Error parsing a video item:', e, node);
                }
            });
            return videoResults;
        }
    };
})(typeof window !== "undefined" ? window : this);