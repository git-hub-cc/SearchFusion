(function (global) {
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;

    if (!utils) {
        console.error("[SearchFusion-RARBG] Utils not found!");
        return;
    }

    global.SearchFusionEngines.rarbg = {
        parse: function () {
            const results = [];
            const engineName = "RARBG";

            const rows = document.querySelectorAll('table.lista2t tr.lista2');
            const getText = (elem) => utils.cleanText(elem ? elem.textContent : "");

            rows.forEach((row) => {
                try {
                    const titleLink = row.querySelector('a[href^="/torrent/"]');
                    if (!titleLink) return;

                    const title = getText(titleLink);
                    if (!title) return;

                    let url = titleLink.getAttribute('href') || titleLink.href || "";
                    if (url && url.startsWith('/')) url = window.location.origin + url;

                    const tds = row.querySelectorAll('td');
                    if (!tds || tds.length < 5) return;

                    const category = getText(tds[2]);
                    const added = getText(tds[3]);
                    const size = getText(tds[4]);
                    const seeders = getText(tds[5]);
                    const leechers = getText(tds[6]);
                    const uploader = getText(tds[7]);

                    const snippetParts = [];
                    if (category) snippetParts.push(`[分类: ${category}]`);
                    if (added) snippetParts.push(`[添加: ${added}]`);
                    if (size) snippetParts.push(`[大小: ${size}]`);
                    if (seeders) snippetParts.push(`[S: ${seeders}]`);
                    if (leechers) snippetParts.push(`[L: ${leechers}]`);
                    if (uploader) snippetParts.push(`[UP: ${uploader}]`);
                    const snippet = snippetParts.join(' ');

                    if (title && url) {
                        results.push(utils.createResult(title, url, snippet, engineName));
                    }
                } catch (e) {
                    console.error('[SearchFusion-RARBG] Error parsing an item:', e, row);
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
