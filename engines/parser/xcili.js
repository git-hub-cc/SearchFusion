(function (global) {
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;

    if (!utils) {
        console.error("[SearchFusion-Xcili] Utils not found!");
        return;
    }

    global.SearchFusionEngines.xcili = {
        parse: function () {
            const results = [];
            const engineName = "无极磁链";

            const rows = document.querySelectorAll('table.file-list tbody tr, table.file-list tr');

            const getText = (elem) => utils.cleanText(elem ? elem.textContent : "");

            rows.forEach((row) => {
                try {
                    const linkElem = row.querySelector('td a') || row.querySelector('a[href]');
                    if (!linkElem) return;

                    // 跳过表头/无效行
                    if (linkElem.closest('thead')) return;

                    const linkClone = linkElem.cloneNode(true);
                    const sample = linkClone.querySelector('p.sample');
                    if (sample) sample.remove();

                    let title = getText(linkClone);
                    if (!title) return;

                    let url = linkElem.getAttribute('href') || linkElem.href || "";
                    if (url && url.startsWith('/')) url = window.location.origin + url;

                    // 兜底：如果标题被 <b> 切碎导致异常，尝试用原始 a 的文本
                    if (!title) title = getText(linkElem);

                    const sizeElem = row.querySelector('td.td-size');
                    const size = getText(sizeElem);

                    const snippet = size ? `[大小: ${size}]` : "";

                    if (title && url) {
                        results.push(utils.createResult(title, url, snippet, engineName));
                    }
                } catch (e) {
                    console.error('[SearchFusion-Xcili] Error parsing an item:', e, row);
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
