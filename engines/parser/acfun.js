/**
 * engines/parser/acfun.js
 * ACFUN (acfun.cn) 专用解析器
 * 针对搜索结果页的 DOM 结构进行解析。
 * ACFUN 的搜索结果页是动态加载的，此解析器仅在加载完成后执行。
 */
(function (global) {
    // 确保全局引擎对象和工具函数存在
    global.SearchFusionEngines = global.SearchFusionEngines || {};
    const utils = global.SearchFusionUtils;
    if (!utils) {
        console.error("[SearchFusion-ACFUN] Utils not found!");
        return;
    }

    // 定义解析器
    global.SearchFusionEngines.acfun = {
        parse: function () {
            const results = [];
            const engineName = "ACFUN"; // 来源标识

            // 1. 查找结果容器
            // ACFUN 页面较为复杂，且可能动态加载。
            // 根据提供的 HTML 结构，搜索结果并不直接存在于初始 HTML 中。
            // 此处模拟解析动态加载后的 DOM 结构。
            // 通常，视频、番剧等结果会以列表或卡片形式出现。
            // 我们使用通用选择器来尝试捕获，因为无法确定具体类名。
            const nodes = document.querySelectorAll('.search__main__list a');

            // 2. 遍历节点列表提取信息
            nodes.forEach((node) => {
                try {
                    // 过滤掉非结果链接
                    if (!node.href || !node.href.includes('/v/ac') && !node.href.includes('/bangumi/')) {
                        return;
                    }

                    const url = node.href;

                    // 尝试提取标题
                    let title = "";
                    const titleElem = node.querySelector('.video-title, .bangumi-title, h1, h2, h3');
                    if (titleElem) {
                        title = utils.cleanText(titleElem.innerText);
                    } else if (node.title) {
                        title = utils.cleanText(node.title);
                    } else {
                        // 作为兜底方案，使用链接内部的文本
                        title = utils.cleanText(node.innerText);
                    }

                    if (!title) return;

                    // 尝试提取摘要
                    let snippet = "";
                    const parentCard = node.closest('.main__list__item, .video-item, .bangumi-item');
                    if (parentCard) {
                        const descElem = parentCard.querySelector('.video-desc, .bangumi-desc, p');
                        if (descElem) {
                            // 避免将标题重复作为摘要
                            const descText = utils.cleanText(descElem.innerText);
                            if (descText !== title) {
                                snippet = descText;
                            }
                        }
                    }

                    // 验证数据有效性
                    if (title && url.startsWith('http')) {
                        results.push(utils.createResult(title, url, snippet, engineName));
                    }
                } catch (e) {
                    console.error(`[SearchFusion-ACFUN] Error parsing an item:`, e, node);
                }
            });

            // 3. 返回去重后的结果
            // ACFUN 页面可能包含重复链接，进行去重处理
            const uniqueResults = [];
            const seenUrls = new Set();
            results.forEach(r => {
                if (r && r.url && !seenUrls.has(r.url)) {
                    seenUrls.add(r.url);
                    uniqueResults.push(r);
                }
            });

            // 如果没有解析到结果，返回一个提示信息
            if(uniqueResults.length === 0){
                const placeholder = utils.createResult(
                    "ACFUN 页面结构复杂或未加载完成",
                    window.location.href,
                    "该页面可能需要动态加载或登录才能查看结果，请尝试“一键直达”手动查看。",
                    engineName
                );
                return [placeholder];
            }

            return uniqueResults;
        }
    };
})(typeof window !== "undefined" ? window : this);