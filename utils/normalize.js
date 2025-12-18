/**
 * utils/normalize.js
 * 数据标准化工具 & 通用辅助函数
 * 挂载到全局 window 对象，供 Content Script 无构建环境使用
 */

(function (global) {
    const Normalizer = {
        /**
         * 创建标准化的搜索结果对象
         */
        createResult: (title, url, snippet, source, searchId = null) => {
            return {
                id: btoa(url + Date.now() + Math.random()).slice(0, 16),
                searchId: searchId,
                title: (title || "无标题").trim(),
                url: url || "#",
                snippet: (snippet || "暂无摘要").trim(),
                source: source,
                timestamp: Date.now()
            };
        },

        /**
         * 清理文本中的多余空白、HTML标签残留
         */
        cleanText: (text) => {
            if (!text) return "";
            return text
                .replace(/[\r\n\t]+/g, " ") // 移除换行
                .replace(/\s+/g, " ")       // 合并空格
                .trim();
        },

        /**
         * 获取当前 URL 参数
         */
        getUrlParam: (paramName) => {
            if (typeof window === 'undefined') return null;
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get(paramName);
        },

        /**
         * 安全检查：是否位于合法的 HTTP/HTTPS 页面
         */
        isValidPage: () => {
            if (typeof window === 'undefined') return false;
            return ['http:', 'https:'].includes(window.location.protocol);
        }
    };

    global.SearchFusionUtils = Normalizer;
})(typeof window !== "undefined" ? window : this);