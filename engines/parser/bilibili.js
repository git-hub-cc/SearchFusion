(function (global) {
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;

    if (!utils) {
        console.error("[SearchFusion-Bilibili] Utils not found!");
        return;
    }

    global.SearchFusionEngines.bilibili = {
        parse: function () {
            const results = [];
            const engineName = "B站";

            const nodes = document.querySelectorAll('div.video.search-all-list .bili-video-card, div.video-list .bili-video-card');

            nodes.forEach((node) => {
                try {
                    const linkElem = node.querySelector('.bili-video-card__wrap a[href*="/video/"]') || node.querySelector('a[href*="/video/"]');
                    const titleElem = node.querySelector('.bili-video-card__info--tit');

                    let title = utils.cleanText(titleElem ? (titleElem.getAttribute('title') || titleElem.innerText) : "");

                    if (!title) {
                        const imgElem = node.querySelector('.bili-video-card__cover img') || node.querySelector('img[alt]');
                        title = utils.cleanText(imgElem ? imgElem.getAttribute('alt') : "");
                    }

                    let url = linkElem ? linkElem.getAttribute('href') : "";
                    if (url && url.startsWith('//')) url = 'https:' + url;
                    if (url && url.startsWith('/')) url = window.location.origin + url;

                    const authorElem = node.querySelector('.bili-video-card__info--author');
                    const dateElem = node.querySelector('.bili-video-card__info--date');

                    const statsItems = node.querySelectorAll('.bili-video-card__stats--left .bili-video-card__stats--item span');
                    const viewText = statsItems && statsItems[0] ? utils.cleanText(statsItems[0].innerText) : "";
                    const danmakuText = statsItems && statsItems[1] ? utils.cleanText(statsItems[1].innerText) : "";
                    const durationElem = node.querySelector('.bili-video-card__stats__duration');

                    const snippetParts = [];
                    const author = utils.cleanText(authorElem ? authorElem.innerText : "");
                    const date = utils.cleanText(dateElem ? dateElem.innerText : "");
                    const duration = utils.cleanText(durationElem ? durationElem.innerText : "");

                    if (author) snippetParts.push(`[UP: ${author}]`);
                    if (date) snippetParts.push(date.replace(/^Â·\s*/, ''));
                    if (viewText) snippetParts.push(`[播放: ${viewText}]`);
                    if (danmakuText) snippetParts.push(`[弹幕: ${danmakuText}]`);
                    if (duration) snippetParts.push(`[时长: ${duration}]`);

                    const snippet = snippetParts.join(' ');

                    if (title && url && url.startsWith('http')) {
                        results.push(utils.createResult(title, url, snippet, engineName));
                    }
                } catch (e) {
                    console.error('[SearchFusion-Bilibili] Error parsing an item:', e, node);
                }
            });

            const unique = [];
            const seen = new Set();
            results.forEach(r => {
                if (r && r.url && !seen.has(r.url)) {
                    seen.add(r.url);
                    unique.push(r);
                }
            });

            return unique;
        }
    };
})(typeof window !== "undefined" ? window : this);
