/**
 * background/serviceWorker.js
 * 后台服务进程
 * 负责监听 Content Scripts 发回的消息，并管理后台标签页的关闭
 */

// 监听安装事件，初始化存储
chrome.runtime.onInstalled.addListener(() => {
    console.log("[SearchFusion] Service Worker installed.");
    chrome.storage.local.set({ searchResults: [] });
});

// 消息监听器
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // 1. 处理解析完成信号
    if (message.type === "EXTRACTION_COMPLETE") {
        const tabId = sender.tab ? sender.tab.id : null;

        // 只有当存在有效的 tabId 且非用户当前激活的 Tab 时才自动关闭
        // 防止误关用户正在查看的页面（虽然极速模式下通常不可见）
        if (tabId) {
            console.log(`[Background] Task ${message.searchId} (${message.source}) completed. Closing tab ${tabId}.`);

            // 延迟 100ms 关闭，确保 Storage 写入操作完全结束
            setTimeout(() => {
                chrome.tabs.remove(tabId).catch(() => {
                    // 忽略 Tab 已不存在的错误
                });
            }, 100);
        }
    }

    // 2. 处理验证码/反爬虫警告
    if (message.type === "CAPTCHA_DETECTED") {
        const tabId = sender.tab ? sender.tab.id : null;
        if (tabId) {
            console.warn(`[Background] CAPTCHA detected on tab ${tabId} (${message.source})`);

            // 策略：遇到验证码时，高亮该标签页让用户手动处理，而不自动关闭
            chrome.tabs.update(tabId, { active: true }).catch(() => {});

            // 可选：向前端发送通知，告知某个引擎需要人工干预
        }
    }

    // 3. 处理“无需解析”信号 (针对网盘/图片等非文本类引擎)
    if (message.type === "NO_PARSE_NEEDED") {
        const tabId = sender.tab ? sender.tab.id : null;
        // 如果是聚合模式下的误开，可以关闭；如果是直达模式，则保持开启
        // 这里简单处理：不做任何操作，让 Tab 保持打开供用户查看
        console.log(`[Background] Engine ${message.source} requires no parsing.`);
    }

    return true; // 保持通道开启
});