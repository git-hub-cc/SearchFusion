/**
 * content-scripts/parser.js
 * 页面解析主控制器 - 极速响应版
 *
 * 优化策略：
 * 1. 移除对 window.load 的强依赖，采用 MutationObserver + 轮询的激进解析策略。
 * 2. 配合 Background 的 CSS 拦截，在 DOM 结构出现后的几百毫秒内即可完成解析。
 * 3. 增加状态锁，防止多次触发导致的数据重复提交。
 */

(function () {
    // 确保工具函数已加载
    const utils = window.SearchFusionUtils;
    if (!utils) return;

    // 1. 任务身份核验
    // 只有 URL 中包含 'sf_id' 参数的页面才被视为插件发起的后台搜索任务
    const searchId = utils.getUrlParam('sf_id');
    if (!searchId) {
        return; // 非插件任务，静默退出
    }

    // 全局状态锁与定时器引用
    let isTaskCompleted = false;
    let observer = null;
    let pollInterval = null;
    let fallbackTimeout = null;

    // 2. 获取引擎标识
    // 优先从 URL 参数 'sf_engine' 获取，备用方案是通过 hostname 推断
    let sourceKey = utils.getUrlParam('sf_engine') || window.location.hostname;
    sourceKey = decodeURIComponent(sourceKey);

    console.log(`[SearchFusion] 解析任务已启动: ID=${searchId}, 来源=${sourceKey}`);

    /**
     * 清理所有监听器和定时器
     * 在任务完成或超时后调用，释放资源
     */
    function cleanup() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        if (fallbackTimeout) {
            clearTimeout(fallbackTimeout);
            fallbackTimeout = null;
        }
    }

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
            if (pageText.length < 500) return true;
        }

        // 策略 3: 严格的启发式检测 (内容短 + 链接少 + 含关键词)
        const isSuspiciouslyShort = pageText.length < 800;
        const hasVeryFewLinks = document.links.length < 5;
        const containsKeyword = captchaKeywords.some(kw => pageText.includes(kw));

        if (isSuspiciouslyShort && hasVeryFewLinks && containsKeyword) {
            return true;
        }

        return false;
    }

    /**
     * 4. 执行解析策略 (核心路由函数)
     * @param {string} triggerSource - 触发来源 (用于调试: 'poll', 'mutation', 'load', 'timeout')
     */
    function executeExtraction(triggerSource) {
        // 如果任务已完成，直接跳过
        if (isTaskCompleted) return;

        // 检测验证码
        if (detectCaptcha()) {
            isTaskCompleted = true;
            cleanup();
            console.warn(`[SearchFusion] 触发验证码拦截 (${triggerSource})`);
            chrome.runtime.sendMessage({ type: 'CAPTCHA_DETECTED', source: sourceKey, searchId });
            return;
        }

        let results = [];
        const Engines = window.SearchFusionEngines || {};
        const hostname = window.location.hostname;

        // --- 解析器路由表 ---
        // 注意：这里仅列出路由逻辑，具体的 Engines 实现依赖于其他注入的脚本
        try {
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
            } else if (hostname.includes('bilibili.com') && Engines.bilibili) {
                results = Engines.bilibili.parse();
            } else if (hostname.includes('pioz.cn') && Engines.quark_station) {
                results = Engines.quark_station.parse();
            } else if (hostname.includes('xykmovie.com') && Engines.xiaoyu) {
                results = Engines.xiaoyu.parse();
            } else if (hostname.includes('rottentomatoes.com') && Engines.rottentomatoes) {
                results = Engines.rottentomatoes.parse();
            } else if (hostname.includes('imdb.com') && Engines.imdb) {
                results = Engines.imdb.parse();
            } else if (hostname.includes('cinematerial.com') && Engines.cinematerial) {
                results = Engines.cinematerial.parse();
            } else if (hostname.includes('filmaffinity.com') && Engines.filmaffinity) {
                results = Engines.filmaffinity.parse();
            } else if (hostname.includes('metacritic.com') && Engines.metacritic) {
                results = Engines.metacritic.parse();
            } else if (hostname.includes('iyf.lv') && Engines.iyf) {
                results = Engines.iyf.parse();
            } else if (hostname.includes('nivod.vip') && Engines.nivod) {
                results = Engines.nivod.parse();
            } else if (hostname.includes('dsxys.com') && Engines.dsxys) {
                results = Engines.dsxys.parse();
            } else if (hostname.includes('gimytv.ai') && Engines.gimy) {
                results = Engines.gimy.parse();
            } else if (hostname.includes('gj5.tv') && Engines.gj5) {
                results = Engines.gj5.parse();
            } else if (hostname.includes('yueyu2.com') && Engines.yueyu2) {
                results = Engines.yueyu2.parse();
            } else if (hostname.includes('acfun.cn') && Engines.acfun) {
                results = Engines.acfun.parse();
            } else if (hostname.includes('anime1.cc') && Engines.anime1) {
                results = Engines.anime1.parse();
            } else if (hostname.includes('xusou.cn') && Engines.xusou) {
                results = Engines.xusou.parse();
            } else if (hostname.includes('dmla8.com') && Engines.dmla8) {
                results = Engines.dmla8.parse();
            } else if (Engines.generic && triggerSource === 'timeout') {
                // 仅在超时兜底时才调用通用解析器，避免页面未加载完就误判
                console.log('[SearchFusion] 触发通用解析器 (超时兜底)');
                results = Engines.generic.parse();
            }
        } catch (e) {
            console.error(`[SearchFusion] 解析执行错误:`, e);
        }

        // 5. 数据回传 (如果获取到了结果)
        if (results && results.length > 0) {
            // 标记任务完成，锁定状态，停止观察
            isTaskCompleted = true;
            cleanup();

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
                console.log(`[SearchFusion] 成功解析 ${results.length} 条结果。来源: ${sourceKey}, 触发: ${triggerSource}`);
                chrome.runtime.sendMessage({
                    type: 'EXTRACTION_COMPLETE',
                    source: sourceKey,
                    searchId: searchId,
                    count: results.length
                });
            });
        }
        // 如果是超时触发，即使没有结果也必须结束任务，防止标签页一直不关闭
        else if (triggerSource === 'timeout') {
            isTaskCompleted = true;
            cleanup();
            console.log(`[SearchFusion] 解析超时，未找到结果。来源: ${sourceKey}`);
            chrome.runtime.sendMessage({
                type: 'EXTRACTION_COMPLETE',
                source: sourceKey,
                searchId: searchId,
                count: 0
            });
        }
    }

    /**
     * 5. 启动极速调度器
     */
    function startScheduler() {
        // 阶段 1: 立即尝试 (针对 SSR 页面)
        executeExtraction('immediate');

        // 阶段 2: 轮询检测 (针对快速渲染的 CSR 页面，前 2 秒每 200ms 查一次)
        // 轮询比 MutationObserver 更可控，避免 DOM 频繁变动导致的性能抖动
        pollInterval = setInterval(() => {
            executeExtraction('poll');
        }, 200);

        // 阶段 3: MutationObserver (作为轮询的补充，精准捕获变化)
        if (window.MutationObserver) {
            observer = new MutationObserver(() => {
                // 简单的防抖，避免一帧内多次触发
                executeExtraction('mutation');
            });
            // 监听 body 的子节点变化
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
        }

        // 阶段 4: 传统的 load 事件 (兜底)
        window.addEventListener('load', () => executeExtraction('load'));

        // 阶段 5: 最终超时兜底 (2.5秒)
        // 即使页面卡死或一直在加载广告，2.5秒后强制结束，避免用户等待过久
        fallbackTimeout = setTimeout(() => {
            if (!isTaskCompleted) {
                console.warn('[SearchFusion] 达到超时限制，强制执行兜底解析。');
                executeExtraction('timeout');
            }
        }, 2500);
    }

    // 启动解析流程
    startScheduler();

})();