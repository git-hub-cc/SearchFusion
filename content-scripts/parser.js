/**
 * content-scripts/parser.js
 * 页面解析主控制器 - 路由分发版
 * 脚本在 document_end 时注入，根据当前页面的 URL 特征，
 * 将解析任务分发给对应的专用解析器（如 google.js）或通用解析器（generic.js）。
 */

(function () {
    // 确保工具函数已加载
    const utils = window.SearchFusionUtils;
    if (!utils) return;

    // 1. 任务身份核验
    // 只有 URL 中包含 'sf_id' 参数的页面才被视为插件发起的后台搜索任务
    const searchId = utils.getUrlParam('sf_id');
    if (!searchId) {
        // 如果不是插件任务，则静默退出，不执行任何操作，以免干扰用户正常浏览
        return;
    }

    // 2. 获取引擎标识
    // 优先从 URL 参数 'sf_engine' 获取，这是在 background 中构建 URL 时添加的
    // 如果 URL 中没有，则尝试通过 hostname 推断，作为备用方案
    let sourceKey = utils.getUrlParam('sf_engine') || window.location.hostname;
    sourceKey = decodeURIComponent(sourceKey); // 解码引擎名称，例如 "今日头条"

    console.log(`[SearchFusion] 解析任务已启动: ID=${searchId}, 来源=${sourceKey}`);

    /**
     * 3. 验证码与反爬虫检测 (鲁棒性增强版)
     * @returns {boolean} - 如果检测到验证码或反爬机制，返回 true
     */
    function detectCaptcha() {
        const pageText = (document.body.innerText || "").toLowerCase();
        const pageTitle = document.title.toLowerCase();

        // 关键词列表
        const captchaKeywords = ["captcha", "验证码", "人机身份验证", "安全验证", "robot", "are you human"];
        const titleKeywords = ["just a moment", "checking your browser", "security check", "人机验证", "安全检查"];

        // --- 策略 1: 检测高置信度的特定元素 ---
        const hasSpecificCaptchaElements =
            document.getElementById('recaptcha') ||                 // Google reCAPTCHA
            document.querySelector('iframe[src*="recaptcha"]') ||
            document.querySelector('iframe[src*="hcaptcha"]') ||    // hCaptcha
            document.querySelector('.w-safety-verification') ||     // 百度安全验证
            document.getElementById('challenge-form');              // Cloudflare 质询表单

        if (hasSpecificCaptchaElements) {
            console.warn(`[SearchFusion] 在 ${sourceKey} 上通过特定元素检测到验证码。`);
            return true;
        }

        // --- 策略 2: 检测页面标题 ---
        if (titleKeywords.some(kw => pageTitle.includes(kw))) {
            console.warn(`[SearchFusion] 在 ${sourceKey} 上通过页面标题检测到验证码。`);
            return true;
        }

        // --- 策略 3: 更严格的启发式检测 ---
        // 真正的验证码页面通常同时满足：内容短、链接少、含关键词
        const isSuspiciouslyShort = pageText.length < 800;
        const hasVeryFewLinks = document.links.length < 10;
        const containsKeyword = captchaKeywords.some(kw => pageText.includes(kw));

        if (isSuspiciouslyShort && hasVeryFewLinks && containsKeyword) {
            console.warn(`[SearchFusion] 在 ${sourceKey} 上通过启发式规则检测到验证码 (内容短、链接少、含关键词)。`);
            return true;
        }

        return false;
    }


    /**
     * 4. 执行解析策略
     * 这是核心的路由和执行函数
     */
    function executeExtraction() {
        // 首先进行验证码检测，如果检测到，则发送消息给 background 并中止解析
        if (detectCaptcha()) {
            chrome.runtime.sendMessage({ type: 'CAPTCHA_DETECTED', source: sourceKey, searchId });
            return;
        }

        let results = [];
        const Engines = window.SearchFusionEngines || {};
        const hostname = window.location.hostname;

        // --- 解析器路由 ---
        // 根据当前页面的 hostname，选择合适的专用解析器
        if (hostname.includes('google.') && Engines.google) {
            console.log('[SearchFusion] 使用 Google 专用解析器');
            results = Engines.google.parse();
        } else if (hostname.includes('bing.com') && Engines.bing) {
            console.log('[SearchFusion] 使用 Bing 专用解析器');
            results = Engines.bing.parse();
        } else if (hostname.includes('baidu.com') && Engines.baidu) {
            console.log('[SearchFusion] 使用 Baidu 专用解析器');
            results = Engines.baidu.parse();
        } else if (hostname.includes('so.toutiao.com') && Engines.toutiao) {
            console.log('[SearchFusion] 使用 Toutiao 专用解析器');
            results = Engines.toutiao.parse();
        } else if (hostname.includes('tool.liumingye.cn') && Engines.liumingye) {
            console.log('[SearchFusion] 使用 LiuMingYe 专用解析器');
            results = Engines.liumingye.parse();
        } else if (hostname.includes('gatherfind.com') && Engines.gatherfind) {
            console.log('[SearchFusion] 使用 Gatherfind 专用解析器');
            results = Engines.gatherfind.parse();
        } else if (hostname.includes('nav.sbkko.com') && Engines.sbkko) {
            console.log('[SearchFusion] 使用 Sbkko 专用解析器');
            results = Engines.sbkko.parse();
        } else if (Engines.generic) {
            // 如果没有匹配的专用解析器，则使用通用解析器作为备用
            console.log('[SearchFusion] 使用通用解析器');
            results = Engines.generic.parse();
        }

        // 5. 数据回传与清理
        if (results && results.length > 0) {
            // 为每个结果对象注入任务元数据
            results = results.map(item => ({
                ...item,
                searchId: searchId,
                source: sourceKey
            }));

            // 使用唯一的键名将结果存入 storage，避免多引擎同时写入时发生冲突
            // 格式：result_任务ID_引擎名Base64截断
            const storageKey = `result_${searchId}_${btoa(encodeURIComponent(sourceKey)).slice(0, 10)}`;
            const storageData = { [storageKey]: results };

            // 将结果写入 local storage，并通知 background 任务完成
            chrome.storage.local.set(storageData, () => {
                console.log(`[SearchFusion] 已保存 ${results.length} 条来自 ${sourceKey} 的结果。请求关闭标签页。`);
                chrome.runtime.sendMessage({
                    type: 'EXTRACTION_COMPLETE',
                    source: sourceKey,
                    searchId: searchId,
                    count: results.length
                });
            });
        } else {
            // 如果没有提取到任何结构化结果
            console.log(`[SearchFusion] 在 ${sourceKey} 未找到可解析的结果。`);
            // 此处可以发送一个 'NO_RESULTS_FOUND' 消息，但目前保持静默
        }
    }

    /**
     * 6. 启动时机控制
     * 确保页面内容完全加载后再执行解析，特别是针对像今日头条这样依赖 <script> 内嵌数据的网站。
     */
    function scheduleExtraction() {
        // 如果页面已经加载完成
        if (document.readyState === 'complete') {
            setTimeout(executeExtraction, 500); // 稍作延迟，等待可能的动态内容渲染
        } else {
            // 否则，监听 'load' 事件
            window.addEventListener('load', () => setTimeout(executeExtraction, 500));
        }

        // 创建一个最终的兜底执行，防止 'load' 事件因某些原因未触发
        setTimeout(executeExtraction, 5000);
    }

    scheduleExtraction();

})();