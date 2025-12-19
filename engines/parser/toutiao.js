/**
 * engines/parser/toutiao.js
 * 今日头条专用解析器
 * 核心逻辑是从页面内嵌的 <script type="application/json"> 中提取 JSON 数据。
 * 经过分析，ID 为 "only_use_in_search_container" 的 <script> 标签包含了最完整的搜索结果数据。
 */
(function (global) {
    // 确保全局引擎对象存在
    global.SearchFusionEngines = global.SearchFusionEngines || {};

    // 定义今日头条解析器
    global.SearchFusionEngines.toutiao = {
        parse: function () {
            const results = [];
            const utils = global.SearchFusionUtils;

            try {
                // 1. 查找包含核心搜索结果数据的 <script> 标签
                const scriptTag = document.getElementById('only_use_in_search_container');
                if (!scriptTag || !scriptTag.textContent) {
                    console.warn('[SearchFusion-Toutiao] 未找到核心数据脚本 <script id="only_use_in_search_container">。');
                    return results;
                }

                // 2. 解析 JSON 数据，增加鲁棒性
                let data;
                try {
                    data = JSON.parse(scriptTag.textContent);
                } catch (jsonError) {
                    console.error('[SearchFusion-Toutiao] 解析 JSON 数据失败:', jsonError);
                    return results;
                }


                // 3. 提取结果列表，路径根据页面结构分析得出，使用可选链增加安全性
                const items = data?.rawData?.data || [];
                if (!items || items.length === 0) {
                    console.warn('[SearchFusion-Toutiao] 在 JSON 数据中未找到搜索结果数组 (data.rawData.data)。');
                    return results;
                }

                // 4. 遍历并标准化结果
                items.forEach(item => {
                    try {
                        // 根据页面数据结构，cell_type 为 67 的是标准网页搜索结果卡片
                        // 其他类型可能是相关搜索、视频、热榜等，在此阶段过滤掉
                        if (item.cell_type !== 67) {
                            return; // 跳过非标准结果
                        }

                        // 安全地提取标题、URL 和摘要
                        const title = item.display?.title?.text;
                        const url = item.url;
                        const snippet = item.display?.summary?.text;

                        // 确保关键信息存在且 URL 是有效的 http 链接
                        if (title && url && url.startsWith('http')) {
                            results.push(utils.createResult(
                                utils.cleanText(title),
                                url,
                                utils.cleanText(snippet),
                                '今日头条' // 明确标识来源
                            ));
                        }
                    } catch (e) {
                        // 忽略单个结果的解析错误，保证后续结果能继续处理
                        console.error('[SearchFusion-Toutiao] 解析单个条目时出错:', e, '条目数据:', item);
                    }
                });

            } catch (e) {
                console.error('[SearchFusion-Toutiao] 解析器主流程发生严重错误:', e);
            }

            return results;
        }
    };
})(typeof window !== "undefined" ? window : this);