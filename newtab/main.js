/**
 * newtab/main.js
 * 前端核心逻辑 (Modern UI 重构版)
 * 负责UI渲染、用户交互、搜索任务分发等。
 */
import { loadEngineConfig, buildSearchUrl } from '../engines/config.js';

// === DOM 元素引用 (缓存以提升性能) ===
const dom = {
    app: document.getElementById('app'),
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    categoryList: document.getElementById('category-list'),

    // 移动端按钮
    btnOpenSidebar: document.getElementById('btn-open-sidebar'),
    btnCloseSidebar: document.getElementById('btn-close-sidebar'),

    // 搜索区
    searchInput: document.getElementById('search-input'),
    btnClear: document.getElementById('btn-clear'),
    btnFusion: document.getElementById('btn-fusion'),
    btnLaunch: document.getElementById('btn-launch'),
    fusionCount: document.getElementById('fusion-count'),
    launchCount: document.getElementById('launch-count'),
    statusBar: document.getElementById('status-bar'),
    statusText: document.getElementById('status-text'),
    spinner: document.querySelector('.spinner'),

    // 视图区
    engineView: document.getElementById('engine-view'),
    resultsView: document.getElementById('results-view'),
    resultsContainer: document.getElementById('results-container'),
    resultsCountDisplay: document.getElementById('res-count-display'),
    btnBack: document.getElementById('btn-back'),
    skeleton: document.getElementById('skeleton'),
    emptyState: document.getElementById('empty-state'),

    // 其他
    themeBtn: document.getElementById('theme-toggle'),
    toastContainer: document.getElementById('toast-container')
};

// === 应用状态管理 ===
const state = {
    config: null,
    currentCategory: 'all',     // 当前选中的分类
    selectedEngines: new Set(), // 已选中的引擎名称集合
    currentSearchId: null,      // 当前搜索任务 ID
    resultsPool: [],            // 搜索结果缓存池
    isMobile: window.innerWidth <= 768
};

// === 初始化流程 ===
async function init() {
    // 1. 加载配置
    state.config = await loadEngineConfig();

    // 2. 渲染 UI
    renderSidebar();
    renderEngineGrid('all'); // 默认显示全部

    // 3. 绑定事件
    bindEvents();
    bindImageErrorFallback();

    // 4. 初始化主题
    initTheme();

    // 5. 初始化浏览器历史记录管理
    initHistory();

    // 6. 监听结果变动 (来自 Background/Content Scripts)
    chrome.storage.onChanged.addListener(handleStorageChange);

    // 7. 清理旧数据 (启动时清理上一次未完成的搜索结果)
    chrome.storage.local.get(null, (items) => {
        const keys = Object.keys(items).filter(k => k.startsWith('result_'));
        if (keys.length) chrome.storage.local.remove(keys);
    });

    // 8. 处理窗口大小变化，适配移动端/桌面端视图
    window.addEventListener('resize', () => {
        state.isMobile = window.innerWidth <= 768;
        if (!state.isMobile) {
            dom.sidebar.classList.remove('open');
            dom.sidebarOverlay.classList.add('hidden');
        }
    });
}

// === 渲染逻辑 (View) ===

/**
 * 渲染侧边栏分类列表
 */
function renderSidebar() {
    const cats = [{ label: '全部', value: 'all', icon: '🌟' }, ...state.config.categories];

    dom.categoryList.innerHTML = cats.map(cat => `
        <li class="nav-item ${cat.value === 'all' ? 'active' : ''}" 
            data-cat="${cat.value}"
            title="${cat.label}">
            <span class="icon">${cat.icon || '📂'}</span>
            <span class="label">${cat.label}</span>
        </li>
    `).join('');
}

/**
 * 渲染引擎网格 (Bento Grid)
 * @param {string} category - 分类 Value
 */
function renderEngineGrid(category) {
    dom.engineView.innerHTML = '';
    const catsToShow = category === 'all'
        ? state.config.categories
        : state.config.categories.filter(c => c.value === category);

    catsToShow.forEach(cat => {
        let engines = state.config.engines[cat.value];
        if (!engines || engines.length === 0) return;

        // [新增逻辑] 排序：将可聚合解析 (parsable !== false) 的引擎排在前面
        // 使用 [...engines] 创建副本以免修改原始配置顺序
        engines = [...engines].sort((a, b) => {
            const aParsable = a.parsable !== false;
            const bParsable = b.parsable !== false;
            // 如果 a 可解析 b 不可，a 排前 (-1)
            // 如果 a 不可解析 b 可，b 排前 (1)
            // 否则保持原序 (0)
            if (aParsable && !bParsable) return -1;
            if (!aParsable && bParsable) return 1;
            return 0;
        });

        const group = document.createElement('div');
        group.className = 'category-group';
        group.innerHTML = `<div class="group-title" id="cat-${cat.value}"><span>${cat.icon}</span> ${cat.label}</div>`;

        const grid = document.createElement('div');
        grid.className = 'grid-container';

        engines.forEach(eng => {
            const isSelected = state.selectedEngines.has(eng.name);
            const isParsable = eng.parsable !== false;
            const card = document.createElement('div');

            card.className = `engine-card ${isSelected ? 'selected' : ''} ${!isParsable ? 'not-parsable' : ''}`;
            card.dataset.name = eng.name;
            if (!isParsable) {
                card.title = "该引擎仅支持“一键直达”模式";
            }

            const iconPath = getLocalEngineIcon(eng.name);

            card.innerHTML = `
                <div class="check-mark">✓</div>
                <img src="${iconPath}" class="engine-icon">
                <div class="engine-name">${eng.name}</div>
            `;

            card.addEventListener('click', () => toggleEngineSelection(eng, card));
            grid.appendChild(card);
        });

        group.appendChild(grid);
        dom.engineView.appendChild(group);
    });
}

/**
 * 获取本地引擎图标路径
 * @param {string} engineName - 引擎名称
 * @returns {string} 图标文件的相对路径
 */
function getLocalEngineIcon(engineName) {
    if (!engineName) return '';
    // 将引擎名称转换为安全的文件名格式 (例如 "今日头条" -> "今日头条.png")
    const filename = engineName
        .replace(/[^\w\s\u4e00-\u9fa5]/g, '') // 移除特殊字符
        .trim()
        .replace(/\s+/g, '_') // 空格转下划线
        .toLowerCase();
    return `../assets/icons/${filename}.png`;
}

/**
 * 获取远程网站的 Favicon
 * @param {string} targetUrl - 目标网址
 * @returns {string} Google Favicon 服务的URL
 */
function getRemoteFavicon(targetUrl) {
    try {
        const domain = new URL(targetUrl.replace('%s', '')).hostname;
        // 使用 Google 的公共 favicon 服务，稳定性高
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch (e) {
        // 如果 URL 解析失败，返回空字符串，后续由 `bindImageErrorFallback` 处理
        return '';
    }
}

// === 交互逻辑 (Controller) ===

/**
 * 绑定所有主要的UI事件监听器
 */
function bindEvents() {
    // 侧边栏分类点击事件
    dom.categoryList.addEventListener('click', (e) => {
        const item = e.target.closest('.nav-item');
        if (!item) return;

        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');

        const cat = item.dataset.cat;
        state.currentCategory = cat;
        renderEngineGrid(cat);
        // 如果当前在结果页，则返回到引擎选择页
        if (history.state?.view !== 'grid') {
            history.back();
        }
        switchView('grid', false);

        if (state.isMobile) toggleSidebar(false);
    });

    // 移动端侧边栏控制
    dom.btnOpenSidebar.addEventListener('click', () => toggleSidebar(true));
    dom.btnCloseSidebar.addEventListener('click', () => toggleSidebar(false));
    dom.sidebarOverlay.addEventListener('click', () => toggleSidebar(false));

    // 搜索按钮事件
    dom.btnLaunch.addEventListener('click', () => performSearch('launch'));
    dom.btnFusion.addEventListener('click', () => performSearch('fusion'));
    dom.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') performSearch('fusion');
    });

    // 搜索框输入与清空
    dom.searchInput.addEventListener('input', (e) => {
        dom.btnClear.classList.toggle('hidden', !e.target.value.trim());
    });
    dom.btnClear.addEventListener('click', () => {
        dom.searchInput.value = '';
        dom.btnClear.classList.add('hidden');
        dom.searchInput.focus();
    });

    // 返回按钮与主题切换
    dom.btnBack.addEventListener('click', () => history.back());
    dom.themeBtn.addEventListener('click', toggleTheme);
}

/**
 * 使用事件委托处理图片加载失败，替换为默认图标
 */
function bindImageErrorFallback() {
    document.addEventListener('error', (e) => {
        const target = e.target;
        // 仅处理 class 包含 'engine-icon' 或 'res-icon' 的图片
        if (target && target.tagName === 'IMG') {
            if (target.classList.contains('engine-icon') || target.classList.contains('res-icon')) {
                target.src = '../assets/default.svg';
            }
            // 防止无限循环触发
            target.onerror = null;
        }
    }, true);
}

/**
 * 初始化浏览器历史记录管理，用于视图切换 (前进/后退)
 */
function initHistory() {
    // 初始状态为引擎网格视图
    history.replaceState({ view: 'grid' }, '', location.pathname);
    window.addEventListener('popstate', (event) => {
        if (event.state) {
            switchView(event.state.view, false);
        }
    });
}

/**
 * 切换移动端侧边栏显示状态
 * @param {boolean} show - true为显示, false为隐藏
 */
function toggleSidebar(show) {
    if (show) {
        dom.sidebar.classList.add('open');
        dom.sidebarOverlay.classList.remove('hidden');
    } else {
        dom.sidebar.classList.remove('open');
        dom.sidebarOverlay.classList.add('hidden');
    }
}

/**
 * 切换引擎的选中状态
 * @param {object} engine - 引擎配置对象
 * @param {HTMLElement} cardElem - 被点击的引擎卡片元素
 */
function toggleEngineSelection(engine, cardElem) {
    if (state.selectedEngines.has(engine.name)) {
        state.selectedEngines.delete(engine.name);
        cardElem.classList.remove('selected');
    } else {
        state.selectedEngines.add(engine.name);
        cardElem.classList.add('selected');
    }
    updateActionButtons();
}

/**
 * 更新操作按钮的角标数字
 * “一键直达”显示所有选中项的数量。
 * “聚合搜索”仅显示可解析的选中项数量。
 */
function updateActionButtons() {
    const allEnginesFlat = Object.values(state.config.engines).flat();
    let parsableCount = 0;

    // 遍历所有已选中的引擎
    state.selectedEngines.forEach(name => {
        const engine = allEnginesFlat.find(e => e.name === name);
        // 如果引擎可解析 (parsable 属性不为 false)，则计数器加一
        if (engine && engine.parsable !== false) {
            parsableCount++;
        }
    });

    const launchCount = state.selectedEngines.size;

    // 更新“聚合搜索”按钮
    dom.fusionCount.textContent = parsableCount;
    dom.fusionCount.classList.toggle('hidden', parsableCount === 0);

    // 更新“一键直达”按钮
    dom.launchCount.textContent = launchCount;
    dom.launchCount.classList.toggle('hidden', launchCount === 0);
}

/**
 * 视图切换器
 * @param {string} viewName - 'grid' (引擎网格) 或 'results' (结果列表)
 * @param {boolean} [updateHistory=true] - 是否更新浏览器历史记录
 */
function switchView(viewName, updateHistory = true) {
    if (viewName === 'results') {
        if (updateHistory && history.state?.view !== 'results') {
            history.pushState({ view: 'results' }, '', '#results');
        }
        dom.engineView.classList.add('hidden');
        dom.engineView.classList.remove('active');
        dom.resultsView.classList.remove('hidden');
        setTimeout(() => dom.resultsView.classList.add('active'), 10);
    } else {
        dom.resultsView.classList.remove('active');
        dom.resultsView.classList.add('hidden');
        dom.engineView.classList.remove('hidden');
        setTimeout(() => dom.engineView.classList.add('active'), 10);
    }
}

// === 搜索核心逻辑 ===

/**
 * 执行搜索操作
 * @param {'fusion' | 'launch'} mode - 'fusion'为聚合搜索, 'launch'为一键直达
 */
function performSearch(mode) {
    const query = dom.searchInput.value.trim();

    // 逻辑调整：聚合搜索模式必须有关键词，一键直达模式允许关键词为空
    if (!query && mode === 'fusion') {
        showToast('聚合搜索需要输入关键词', 'warning');
        return;
    }

    // 确定要搜索的目标引擎
    let targets = [];
    if (state.selectedEngines.size > 0) {
        // 如果用户有选择，则使用用户选择的引擎
        const allEngines = Object.values(state.config.engines).flat();
        targets = allEngines.filter(e => state.selectedEngines.has(e.name));
    } else {
        // 如果用户未选择，则使用当前分类下的前3个作为默认引擎
        const defaultCategory = state.currentCategory === 'all' ? 'search' : state.currentCategory;
        const pool = state.config.engines[defaultCategory] || [];
        targets = pool.slice(0, 3);
    }

    if (targets.length === 0) {
        showToast('未找到可用引擎，请尝试选择其他分类', 'error');
        return;
    }

    // 对聚合模式进行特殊处理，过滤掉不支持聚合的引擎
    if (mode === 'fusion') {
        const parsableTargets = targets.filter(eng => eng.parsable !== false);
        if (parsableTargets.length === 0) {
            showToast('所选引擎均不支持聚合模式，请尝试“一键直达”', 'warning');
            return;
        }
        if (parsableTargets.length < targets.length) {
            const skippedCount = targets.length - parsableTargets.length;
            showToast(`已为您跳过 ${skippedCount} 个不支持聚合的引擎`, 'info');
        }
        targets = parsableTargets;
    }

    const searchId = Date.now().toString(36);
    state.currentSearchId = searchId;

    if (mode === 'launch') {
        targets.forEach(eng => {
            // [核心修改] “一键直达”模式，构建不带追踪参数的干净URL。
            // 仅替换关键词占位符，不附加 sf_id 等参数。
            // 这样内容脚本就不会在这些标签页上激活，从而避免它们被后台服务自动关闭。
            const url = eng.url.replace('%s', encodeURIComponent(query));

            // [新增逻辑] 当只有一个目标时，自动聚焦该标签页；否则保持在后台打开
            const shouldActivate = targets.length === 1;
            chrome.tabs.create({ url, active: shouldActivate });
        });
        showToast(`已为您打开 ${targets.length} 个页面`, 'success');
    } else { // 聚合搜索模式
        switchView('results');
        state.resultsPool = [];
        dom.resultsContainer.innerHTML = '';
        dom.resultsCountDisplay.textContent = '0';
        dom.skeleton.classList.remove('hidden');
        dom.emptyState.classList.add('hidden');
        dom.statusBar.classList.remove('hidden');
        dom.spinner.classList.remove('hidden');
        dom.statusText.textContent = `正在从 ${targets.length} 个来源聚合...`;

        // 错开时间创建标签页，减轻浏览器瞬时压力
        targets.forEach((eng, index) => {
            setTimeout(() => {
                const url = buildSearchUrl(eng, query, searchId);
                chrome.tabs.create({ url, active: false });
            }, index * 200); // 每隔200ms创建一个
        });
    }
}

// === 结果处理 ===

/**
 * 监听 storage 变化，接收来自内容脚本的解析结果
 * @param {object} changes - 发生变化的数据
 * @param {string} area - 存储区域 ('local', 'sync')
 */
function handleStorageChange(changes, area) {
    if (area !== 'local') return;

    for (let [key, { newValue }] of Object.entries(changes)) {
        // 只处理属于当前搜索任务的结果
        if (!key.startsWith(`result_${state.currentSearchId}`)) continue;
        if (!newValue || newValue.length === 0) continue;

        renderResults(newValue);
        // 读取后立即删除，避免数据残留
        chrome.storage.local.remove(key);
    }
}

/**
 * 渲染搜索结果到页面上
 * @param {Array<object>} newResults - 新的搜索结果数组
 */
function renderResults(newResults) {
    dom.skeleton.classList.add('hidden');
    dom.emptyState.classList.add('hidden');

    // 去重：只添加结果池中不存在的URL
    const validItems = newResults.filter(r => !state.resultsPool.some(pool => pool.url === r.url));
    if (validItems.length === 0) return;

    state.resultsPool.push(...validItems);
    dom.resultsCountDisplay.textContent = state.resultsPool.length;

    const fragment = document.createDocumentFragment();
    validItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'result-card';
        const favicon = getRemoteFavicon(item.url);

        div.innerHTML = `
            <div class="res-badge">
                <img src="${favicon}" class="res-icon">
                ${item.source}
            </div>
            <a href="${item.url}" class="res-title" target="_blank" rel="noopener noreferrer">${item.title}</a>
            <div class="res-snippet">${item.snippet || '暂无摘要内容...'}</div>
        `;
        fragment.appendChild(div);
    });

    dom.resultsContainer.appendChild(fragment);

    // 更新状态栏信息
    dom.spinner.classList.add('hidden');
    dom.statusText.textContent = '聚合完成';
}

// === 辅助功能 ===

/**
 * 显示一个短暂的通知（Toast）
 * @param {string} msg - 通知内容
 * @param {'info' | 'success' | 'warning' | 'error'} [type='info'] - 通知类型
 */
function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    dom.toastContainer.appendChild(toast);

    // 3秒后自动消失
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * 初始化并应用保存的主题（浅色/深色）
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.dataset.theme = savedTheme;
}

/**
 * 切换并保存主题
 */
function toggleTheme() {
    const currentTheme = document.body.dataset.theme;
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.dataset.theme = nextTheme;
    localStorage.setItem('theme', nextTheme);
}

// === 应用启动 ===
document.addEventListener('DOMContentLoaded', init);