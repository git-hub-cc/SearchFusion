(function (global) {
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;

    if (!utils) {
        console.error("[SearchFusion-PirateBay_1] Utils not found!");
        return;
    }

    global.SearchFusionEngines.piratebay_1 = {
        parse: function () {
            const results = [];
            const engineName = "海盗湾_1";

            const rows = document.querySelectorAll('#searchResult tr');

            const getText = (elem) => utils.cleanText(elem ? elem.textContent : "");

            rows.forEach((row) => {
                try {
                    const titleLink = row.querySelector('a[href*="/torrent/"]');
                    if (!titleLink) return;

                    const title = getText(titleLink);
                    if (!title) return;

                    const magnetElem = row.querySelector('a[href^="magnet:"]');
                    const magnetHref = magnetElem ? (magnetElem.getAttribute('href') || magnetElem.href || "") : "";

                    let url = titleLink.href || titleLink.getAttribute('href') || "";
                    if (url && url.startsWith('/')) url = window.location.origin + url;

                    const tds = row.querySelectorAll('td');
                    const uploaded = getText(tds[2]);
                    const size = getText(tds[4] || tds[3]);
                    const seeders = getText(tds[5] || tds[4]);
                    const leechers = getText(tds[6] || tds[5]);

                    const snippetParts = [];
                    if (size) snippetParts.push(`[大小: ${size}]`);
                    if (uploaded) snippetParts.push(`[上传: ${uploaded}]`);
                    if (seeders) snippetParts.push(`[SE: ${seeders}]`);
                    if (leechers) snippetParts.push(`[LE: ${leechers}]`);
                    if (magnetHref) snippetParts.push(`[Magnet: ${encodeURI(magnetHref)}]`);
                    const snippet = snippetParts.join(' ');

                    if (title && url) {
                        results.push(utils.createResult(title, url, snippet, engineName));
                    }
                } catch (e) {
                    console.error('[SearchFusion-PirateBay_1] Error parsing an item:', e, row);
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
