/**
 * content-scripts/parser.js
 * 页面解析主控制器 - 路由分发版
 * 脚本在 document_end 时注入，根据当前页面的 URL 特征，
 * 将解析任务分发给对应的专用解析器。
 */

(function () {
    // 确保工具函数已加载
    const utils = window.SearchFusionUtils;
    if (!utils) return;

    // 1. 任务身份核验
    // 只有 URL 中包含 'sf_id' 参数的页面才被视为插件发起的后台搜索任务
    const searchId = utils.getUrlParam('sf_id');
    if (!searchId) {
        // 如果不是插件任务，则静默退出，不执行任何操作
        return;
    }

    // 2. 获取引擎标识
    // 优先从 URL 参数 'sf_engine' 获取，备用方案是通过 hostname 推断
    let sourceKey = utils.getUrlParam('sf_engine') || window.location.hostname;
    sourceKey = decodeURIComponent(sourceKey);

    console.log(`[SearchFusion] 解析任务已启动: ID=${searchId}, 来源=${sourceKey}`);

    /**
     * 3. 验证码与反爬虫检测
     * @returns {boolean} - 如果检测到验证码或反爬机制，返回 true
     */
    function detectCaptcha() {
        const pageText = (document.body.innerText || "").toLowerCase();
        const pageTitle = document.title.toLowerCase();

        // 关键词列表
        const captchaKeywords = ["captcha", "验证码", "人机身份验证", "安全验证", "robot", "are you human"];
        // 标题关键词通常是 100% 准确的拦截信号
        const titleKeywords = ["just a moment", "checking your browser", "security check", "人机验证", "安全检查", "ddos-guard"];

        // 策略 1: 检测页面标题
        if (titleKeywords.some(kw => pageTitle.includes(kw))) {
            console.warn(`[SearchFusion] 在 ${sourceKey} 上通过页面标题检测到验证码/WAF拦截。`);
            return true;
        }

        // 策略 2: 检测高置信度的特定元素
        const hasSpecificCaptchaElements =
            document.getElementById('recaptcha') ||
            document.querySelector('iframe[src*="recaptcha"]') ||
            document.querySelector('iframe[src*="hcaptcha"]') ||
            document.querySelector('.w-safety-verification') ||
            document.getElementById('challenge-form');

        if (hasSpecificCaptchaElements) {
            // 结合内容长度判断，只有内容极短时才判定为拦截
            if (pageText.length < 500) {
                console.warn(`[SearchFusion] 在 ${sourceKey} 上通过特定元素+短内容检测到验证码。`);
                return true;
            }
        }

        // 策略 3: 严格的启发式检测 (内容短 + 链接少 + 含关键词)
        const isSuspiciouslyShort = pageText.length < 800;
        const hasVeryFewLinks = document.links.length < 5;
        const containsKeyword = captchaKeywords.some(kw => pageText.includes(kw));

        if (isSuspiciouslyShort && hasVeryFewLinks && containsKeyword) {
            console.warn(`[SearchFusion] 在 ${sourceKey} 上通过启发式规则检测到验证码。`);
            return true;
        }

        return false;
    }


    /**
     * 4. 执行解析策略
     * 核心路由函数
     */
    function executeExtraction() {
        // 检测验证码
        if (detectCaptcha()) {
            chrome.runtime.sendMessage({ type: 'CAPTCHA_DETECTED', source: sourceKey, searchId });
            return;
        }

        let results = [];
        const Engines = window.SearchFusionEngines || {};
        const hostname = window.location.hostname;

        // --- 解析器路由表 ---
        if (hostname.includes('google.') && Engines.google) {
            results = Engines.google.parse();
        } else if (hostname.includes('bing.com') && Engines.bing) {
            results = Engines.bing.parse();
        } else if (hostname.includes('baidu.com') && Engines.baidu) {
            results = Engines.baidu.parse();
        } else if (hostname.includes('yandex.') && Engines.yandex) {
            results = Engines.yandex.parse();
        } else if (hostname.includes('so.toutiao.com') && Engines.toutiao) {
            results = Engines.toutiao.parse();
        } else if (hostname.includes('tool.liumingye.cn') && Engines.liumingye) {
            results = Engines.liumingye.parse();
        } else if (hostname.includes('gatherfind.com') && Engines.gatherfind) {
            results = Engines.gatherfind.parse();
        } else if (hostname.includes('nav.sbkko.com') && Engines.sbkko) {
            results = Engines.sbkko.parse();
        } else if (hostname.includes('upyunso.com') && Engines.upyunso) {
            results = Engines.upyunso.parse();
        } else if (hostname.includes('pansearch.me') && Engines.pansearch) {
            results = Engines.pansearch.parse();
        } else if (hostname.includes('thepiratebay11.com') && Engines.piratebay_1) {
            results = Engines.piratebay_1.parse();
        } else if (hostname.includes('thepiratebay10.xyz') && Engines.piratebay_2) {
            results = Engines.piratebay_2.parse();
        } else if (hostname.includes('xcili.net') && Engines.xcili) {
            results = Engines.xcili.parse();
        } else if (hostname.includes('rargb.to') && Engines.rarbg) {
            results = Engines.rarbg.parse();
        }  else if (hostname.includes('bilibili.com') && Engines.bilibili) {
            results = Engines.bilibili.parse();
        } else if (hostname.includes('pioz.cn') && Engines.quark_station) {
            // [新增] 夸克小站
            console.log('[SearchFusion] 使用 夸克小站 专用解析器');
            results = Engines.quark_station.parse();
        } else if (hostname.includes('xykmovie.com') && Engines.xiaoyu) {
            // [新增] 小宇搜索
            console.log('[SearchFusion] 使用 小宇搜索 专用解析器');
            results = Engines.xiaoyu.parse();
        } else if (Engines.generic) {
            // 兜底通用解析器
            console.log('[SearchFusion] 使用通用解析器');
            results = Engines.generic.parse();
        }

        // 5. 数据回传
        if (results && results.length > 0) {
            // 注入元数据
            results = results.map(item => ({
                ...item,
                searchId: searchId,
                source: sourceKey
            }));

            // 存入 Storage
            const storageKey = `result_${searchId}_${btoa(encodeURIComponent(sourceKey)).slice(0, 10)}`;
            const storageData = { [storageKey]: results };

            chrome.storage.local.set(storageData, () => {
                console.log(`[SearchFusion] 已保存 ${results.length} 条来自 ${sourceKey} 的结果。`);
                chrome.runtime.sendMessage({
                    type: 'EXTRACTION_COMPLETE',
                    source: sourceKey,
                    searchId: searchId,
                    count: results.length
                });
            });
        } else {
            console.log(`[SearchFusion] 在 ${sourceKey} 未找到可解析的结果。`);
        }
    }

    /**
     * 5. 启动控制
     */
    function scheduleExtraction() {
        if (document.readyState === 'complete') {
            setTimeout(executeExtraction, 500);
        } else {
            window.addEventListener('load', () => setTimeout(executeExtraction, 500));
        }
        // 兜底
        setTimeout(executeExtraction, 5000);
    }

    scheduleExtraction();

})();