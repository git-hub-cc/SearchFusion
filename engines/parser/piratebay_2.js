(function (global) {
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;

    if (!utils) {
        console.error("[SearchFusion-PirateBay_2] Utils not found!");
        return;
    }

    global.SearchFusionEngines.piratebay_2 = {
        parse: function () {
            const results = [];
            const engineName = "海盗湾_2";

            const rows = document.querySelectorAll('#searchResult tr');

            rows.forEach((row) => {
                try {
                    const titleLink = row.querySelector('a[href*="/torrent/"]');
                    if (!titleLink) return;

                    const title = utils.cleanText(titleLink.textContent);
                    if (!title) return;

                    const magnetElem = row.querySelector('a[href^="magnet:"]');
                    let url = magnetElem ? (magnetElem.getAttribute('href') || magnetElem.href) : (titleLink.href || titleLink.getAttribute('href') || "");
                    if (url && url.startsWith('/')) url = window.location.origin + url;

                    const tds = row.querySelectorAll('td');
                    const uploaded = tds[2] ? utils.cleanText(tds[2].innerText) : "";
                    const size = tds[3] ? utils.cleanText(tds[3].innerText) : "";
                    const seeders = tds[4] ? utils.cleanText(tds[4].innerText) : "";
                    const leechers = tds[5] ? utils.cleanText(tds[5].innerText) : "";

                    const snippetParts = [];
                    if (size) snippetParts.push(`[大小: ${size}]`);
                    if (uploaded) snippetParts.push(`[上传: ${uploaded}]`);
                    if (seeders) snippetParts.push(`[SE: ${seeders}]`);
                    if (leechers) snippetParts.push(`[LE: ${leechers}]`);
                    const snippet = snippetParts.join(' ');

                    if (title && url) {
                        results.push(utils.createResult(title, url, snippet, engineName));
                    }
                } catch (e) {
                    console.error('[SearchFusion-PirateBay_2] Error parsing an item:', e, row);
                }
            });

            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);
