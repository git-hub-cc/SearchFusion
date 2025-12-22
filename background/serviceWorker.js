/**
 * background/serviceWorker.js
 * 后台服务进程
 * 负责监听前端消息、创建并管理后台标签页、配置网络拦截规则以加速解析
 */

// 定义需要拦截的资源类型，以加速页面加载并节省流量
// 包含样式表和子框架，用于初次激进加载
const BLOCKED_RESOURCE_TYPES = [
    "image",
    "media",
    "stylesheet",
    "font",
    "object",
    "websocket",
    "ping",
    "csp_report",
    "sub_frame"
];

// 监听安装事件，初始化存储
chrome.runtime.onInstalled.addListener(() => {
    console.log("[SearchFusion] Service Worker installed.");
    chrome.storage.local.set({ searchResults: [] });
});

/**
 * 为指定 Tab ID 应用网络拦截规则
 * 使用 declarativeNetRequest 的 Session Rules
 * @param {number} tabId
 */
async function enableResourceBlocking(tabId) {
    try {
        const ruleId = parseInt(tabId);
        await chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: [ruleId], // 先移除旧规则（如果有）防止冲突
            addRules: [{
                id: ruleId,
                priority: 1,
                action: { type: "block" },
                condition: {
                    tabIds: [tabId],
                    resourceTypes: BLOCKED_RESOURCE_TYPES
                }
            }]
        });
        console.log(`[Background] 拦截规则已启用: Tab ${tabId}`);
    } catch (error) {
        console.error(`[Background] 启用拦截失败 Tab ${tabId}:`, error);
    }
}

/**
 * 清除指定 Tab ID 的拦截规则
 * @param {number} tabId
 */
async function disableResourceBlocking(tabId) {
    try {
        const ruleId = parseInt(tabId);
        await chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: [ruleId]
        });
        console.log(`[Background] 拦截规则已移除: Tab ${tabId}`);
    } catch (error) {
        // 忽略规则不存在的错误
    }
}

// 消息监听器
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const senderTabId = sender.tab ? sender.tab.id : null;

    // 0. 处理创建后台任务标签页请求
    if (message.type === "CREATE_FUSION_TAB") {
        (async () => {
            try {
                // 1. 创建空白页
                const tab = await chrome.tabs.create({
                    url: "about:blank",
                    active: false
                });

                if (!tab || !tab.id) return;

                // 2. 启用激进拦截
                await enableResourceBlocking(tab.id);

                // 3. 导航目标
                await chrome.tabs.update(tab.id, {
                    url: message.url
                });

            } catch (e) {
                console.error("[Background] 创建任务页失败:", e);
            }
        })();
        return false;
    }

    // 1. 处理解析完成信号
    if (message.type === "EXTRACTION_COMPLETE") {
        if (senderTabId) {
            console.log(`[Background] 任务完成 ${message.searchId} (${message.source}). 关闭 Tab ${senderTabId}.`);
            // 延迟关闭确保数据写入
            setTimeout(() => {
                chrome.tabs.remove(senderTabId).catch(() => {});
            }, 100);
        }
    }

    // 2. 处理兜底重试信号 (新增逻辑)
    // 当初次解析超时或失败时，移除拦截规则并刷新页面，应对反爬虫或强依赖 CSS/JS 的页面
    if (message.type === "RETRY_WITHOUT_BLOCKING") {
        if (senderTabId) {
            (async () => {
                console.warn(`[Background] 触发兜底重试: Tab ${senderTabId} (${message.source}) - 移除拦截并刷新`);

                // 1. 移除该 Tab 的所有拦截规则
                await disableResourceBlocking(senderTabId);

                // 2. 构造重试 URL，添加标记防止死循环
                let currentUrl = sender.tab.url;
                if (currentUrl.includes("sf_retry=1")) {
                    // 如果已经是重试状态，不再重复刷新，防止死循环
                    return;
                }

                const separator = currentUrl.includes("?") ? "&" : "?";
                const retryUrl = `${currentUrl}${separator}sf_retry=1`;

                // 3. 刷新页面
                chrome.tabs.update(senderTabId, { url: retryUrl });
            })();
        }
    }

    // 3. 处理验证码警告
    if (message.type === "CAPTCHA_DETECTED") {
        if (senderTabId) {
            console.warn(`[Background] 检测到验证码 Tab ${senderTabId}`);
            chrome.tabs.update(senderTabId, { active: true }).catch(() => {});
        }
    }

    return true;
});

// 监听标签页关闭事件，自动清理规则
chrome.tabs.onRemoved.addListener((tabId) => {
    disableResourceBlocking(tabId);
});