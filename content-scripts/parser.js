/**
 * content-scripts/parser.js
 * 页面解析主控制器 - 路由分发版
 * 根据域名或 URL 参数，将任务分发给 专用解析器 或 通用解析器
 */

(function () {
    const utils = window.SearchFusionUtils;
    if (!utils) return;

    // 1. 任务身份核验
    // 只有 URL 中包含 sf_id 参数的页面才会被视为插件发起的后台任务
    const searchId = utils.getUrlParam('sf_id');
    if (!searchId) {
        // 非插件任务，静默退出，不干扰用户正常浏览
        return;
    }

    // 获取引擎标识 (优先从 URL 参数获取，这是我们在 config.js 中构建的)
    // 如果 URL 中没有，则尝试通过 hostname 推断
    let sourceKey = utils.getUrlParam('sf_engine') || window.location.hostname;
    // 简单解码
    sourceKey = decodeURIComponent(sourceKey);

    console.log(`[SearchFusion] Task Detected: ID=${searchId}, Source=${sourceKey}`);

    // 2. 验证码与反爬检测
    function detectCaptcha() {
        const pageText = document.body.innerText || "";
        const captchaKeywords = ["traffic", "captcha", "验证码", "异常流量", "人机身份验证", "安全验证"];

        // 特征元素检测
        const hasRecaptcha = document.getElementById('recaptcha') ||
            document.querySelector('iframe[src*="recaptcha"]') ||
            document.querySelector('.w-safety-verification');

        if (hasRecaptcha || (pageText.length < 1000 && captchaKeywords.some(kw => pageText.includes(kw)))) {
            return true;
        }
        return false;
    }

    // 3. 执行解析策略
    function executeExtraction() {
        if (detectCaptcha()) {
            chrome.runtime.sendMessage({ type: 'CAPTCHA_DETECTED', source: sourceKey, searchId });
            return;
        }

        let results = [];
        const Engines = window.SearchFusionEngines || {};

        // 策略路由
        if (window.location.hostname.includes('google.') && Engines.google) {
            results = Engines.google.parse();
        } else if (window.location.hostname.includes('bing.com') && Engines.bing) {
            results = Engines.bing.parse();
        } else if (window.location.hostname.includes('baidu.com') && Engines.baidu) {
            results = Engines.baidu.parse();
        } else if (Engines.generic) {
            // 对于没有专用脚本的 100+ 个网站，使用通用解析器
            console.log('[SearchFusion] Using Generic Parser');
            results = Engines.generic.parse();
        }

        // 4. 数据回传与清理
        if (results && results.length > 0) {
            // 注入任务元数据
            results = results.map(item => ({
                ...item,
                searchId: searchId,
                source: sourceKey // 保持与分类中的名称一致
            }));

            // 写入 Storage
            const storageKey = `result_${searchId}_${btoa(sourceKey).slice(0, 10)}`; // 防止 Key 包含非法字符
            const storageData = {};
            storageData[storageKey] = results;

            chrome.storage.local.set(storageData, () => {
                console.log(`[SearchFusion] Saved ${results.length} results. Requesting close.`);
                chrome.runtime.sendMessage({
                    type: 'EXTRACTION_COMPLETE',
                    source: sourceKey,
                    searchId: searchId,
                    count: results.length
                });
            });
        } else {
            // 未提取到结果（可能是加载慢，也可能是非文本类网站）
            // 在通用模式下，不强制关闭空结果 Tab，留给用户查看
            console.log('[SearchFusion] No structured results found.');
        }
    }

    // 5. 启动时机控制
    // 尝试立即执行
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(executeExtraction, 500); // 稍作延迟等待动态内容
    } else {
        window.addEventListener('DOMContentLoaded', () => setTimeout(executeExtraction, 500));
        window.addEventListener('load', () => setTimeout(executeExtraction, 500));
    }

    // 兜底：如果页面很慢，5秒后再试一次
    setTimeout(executeExtraction, 5000);

})();