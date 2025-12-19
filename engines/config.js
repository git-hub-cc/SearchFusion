/**
 * engines/config.js
 * 搜索引擎配置管理器
 * 负责从 JSON 资源加载数据，并提供构建搜索 URL 的工具函数
 */

let cachedConfig = null;

/**
 * 异步加载搜索引擎配置
 * @returns {Promise<Object>} 包含 categories 和 engines 的对象
 */
export async function loadEngineConfig() {
    if (cachedConfig) return cachedConfig;

    try {
        const url = chrome.runtime.getURL('engines/engines.json');
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load engines.json');

        cachedConfig = await response.json();
        return cachedConfig;
    } catch (error) {
        console.error('[SearchFusion] Config load error:', error);
        return { categories: [], engines: {} };
    }
}

/**
 * 构建带有任务参数的搜索链接
 * @param {Object} engineObj 引擎配置对象
 * @param {string} query 搜索关键词
 * @param {string} searchId 任务ID
 * @returns {string} 完整的搜索 URL
 */
export function buildSearchUrl(engineObj, query, searchId) {
    if (!engineObj || !engineObj.url) return '';

    // 1. 替换关键词占位符
    let url = engineObj.url.replace('%s', encodeURIComponent(query));

    // 2. 追加任务追踪参数 (用于 Content Script 识别)
    // 检查 URL 是否已有参数
    const separator = url.includes('?') ? '&' : '?';

    // sf_id: 任务批次 ID
    // sf_engine: 引擎名称 (用于 Log 或特定解析)
    url += `${separator}sf_id=${searchId}&sf_engine=${encodeURIComponent(engineObj.name)}`;

    return url;
}

/**
 * 判断引擎是否适合聚合解析
 * 策略：目前仅针对 search、question、programming 等文本类分类开启聚合
 * 其他分类（如网盘、图片）通常需要复杂交互或无纯文本摘要，建议走直达模式
 * @param {string} category 分类Key
 * @returns {boolean}
 */
export function isParsableCategory(category) {
    const parsable = [
        'search', 'ai', 'encyclopedia', 'programming', 'question', 'news', 'academic'
    ];
    return parsable.includes(category);
}