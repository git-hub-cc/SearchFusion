/**
 * engines/parser/filmaffinity.js
 * FilmAffinity (filmaffinity.com) 专用解析器
 */
(function (global) {
    // 确保全局引擎对象和工具函数存在
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;

    if (!utils) {
        console.error("[SearchFusion-FilmAffinity] Utils not found!");
        return;
    }

    global.SearchFusionEngines.filmaffinity = {
        parse: function () {
            const results = [];
            const engineName = "FilmAffinity";

            // 专注于提取 "Title" 板块的结果
            const nodes = document.querySelectorAll('#title-result .movie-card');

            nodes.forEach((node) => {
                try {
                    // 提取标题和链接
                    const titleElem = node.querySelector('.mc-title a');
                    if (!titleElem) return;

                    const title = utils.cleanText(titleElem.innerText);
                    const url = titleElem.href; // 链接已是绝对路径

                    if (!title || !url || !url.startsWith('http')) return;

                    // --- 构建摘要信息 ---
                    const snippetParts = [];

                    // 1. 提取年份
                    const yearElem = node.querySelector('.mc-year');
                    if (yearElem) {
                        snippetParts.push(`[年份: ${utils.cleanText(yearElem.innerText)}]`);
                    }

                    // 2. 提取评分
                    const ratingElem = node.querySelector('.avg-rat-box .avg, .fa-avg-rat-box .avg');
                    if (ratingElem) {
                        snippetParts.push(`[评分: ${utils.cleanText(ratingElem.innerText)}]`);
                    }

                    // 3. 提取导演
                    const directorElem = node.querySelector('.mc-director .credits');
                    if (directorElem) {
                        snippetParts.push(`[导演: ${utils.cleanText(directorElem.innerText)}]`);
                    }

                    // 4. 提取演员表 (截取部分)
                    const castElem = node.querySelector('.mc-cast .credits');
                    if (castElem) {
                        let castText = utils.cleanText(castElem.innerText);
                        // 移除末尾的 "..."
                        castText = castText.replace(/\s*\.\.\.$/, '');
                        snippetParts.push(`[主演: ${castText}]`);
                    }

                    const snippet = snippetParts.join(' | ');

                    results.push(utils.createResult(title, url, snippet, engineName));

                } catch (e) {
                    console.error('[SearchFusion-FilmAffinity] Error parsing an item:', e, node);
                }
            });

            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);