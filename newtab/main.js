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

        // 排序：将可聚合解析 (parsable !== false) 的引擎排在前面
        engines = [...engines].sort((a, b) => {
            const aParsable = a.parsable !== false;
            const bParsable = b.parsable !== false;
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
    const filename = engineName
        .replace(/[^\w\s\u4e00-\u9fa5]/g, '')
        .trim()
        .replace(/\s+/g, '_')
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
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch (e) {
        return '';
    }
}

/**
 * 获取最佳匹配的图标 (优先本地，其次远程)
 * @param {string} sourceName - 结果来源名称 (如 "B站", "Google")
 * @param {string} itemUrl - 结果的 URL
 */
function getBestIcon(sourceName, itemUrl) {
    // 1. 尝试匹配本地引擎图标
    // 遍历所有配置的引擎，检查名称是否与来源一致
    const allEngines = Object.values(state.config.engines).flat();
    const matchedEngine = allEngines.find(e => e.name === sourceName);

    if (matchedEngine) {
        return getLocalEngineIcon(matchedEngine.name);
    }

    // 2. 如果没有匹配的本地引擎，回退到远程获取
    return getRemoteFavicon(itemUrl);
}

// === 交互逻辑 (Controller) ===

/**
 * 绑定所有主要的UI事件监听器
 */
function bindEvents() {
    dom.categoryList.addEventListener('click', (e) => {
        const item = e.target.closest('.nav-item');
        if (!item) return;

        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');

        const cat = item.dataset.cat;
        state.currentCategory = cat;
        renderEngineGrid(cat);
        if (history.state?.view !== 'grid') {
            history.back();
        }
        switchView('grid', false);

        if (state.isMobile) toggleSidebar(false);
    });

    dom.btnOpenSidebar.addEventListener('click', () => toggleSidebar(true));
    dom.btnCloseSidebar.addEventListener('click', () => toggleSidebar(false));
    dom.sidebarOverlay.addEventListener('click', () => toggleSidebar(false));

    dom.btnLaunch.addEventListener('click', () => performSearch('launch'));
    dom.btnFusion.addEventListener('click', () => performSearch('fusion'));
    dom.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') performSearch('fusion');
    });

    dom.searchInput.addEventListener('input', (e) => {
        dom.btnClear.classList.toggle('hidden', !e.target.value.trim());
    });
    dom.btnClear.addEventListener('click', () => {
        dom.searchInput.value = '';
        dom.btnClear.classList.add('hidden');
        dom.searchInput.focus();
    });

    dom.btnBack.addEventListener('click', () => history.back());
    dom.themeBtn.addEventListener('click', toggleTheme);
}

/**
 * 使用事件委托处理图片加载失败，替换为默认图标
 */
function bindImageErrorFallback() {
    document.addEventListener('error', (e) => {
        const target = e.target;
        if (target && target.tagName === 'IMG') {
            if (target.classList.contains('engine-icon') || target.classList.contains('res-icon')) {
                // 如果是本地图标加载失败（可能名字匹配错误），尝试降级为远程图标
                // 如果已经是默认图标则不再处理，防止死循环
                if (!target.src.includes('default.svg')) {
                    target.src = '../assets/default.svg';
                }
            }
            target.onerror = null;
        }
    }, true);
}

/**
 * 初始化浏览器历史记录管理
 */
function initHistory() {
    history.replaceState({ view: 'grid' }, '', location.pathname);
    window.addEventListener('popstate', (event) => {
        if (event.state) {
            switchView(event.state.view, false);
        }
    });
}

function toggleSidebar(show) {
    if (show) {
        dom.sidebar.classList.add('open');
        dom.sidebarOverlay.classList.remove('hidden');
    } else {
        dom.sidebar.classList.remove('open');
        dom.sidebarOverlay.classList.add('hidden');
    }
}

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

function updateActionButtons() {
    const allEnginesFlat = Object.values(state.config.engines).flat();
    let parsableCount = 0;

    state.selectedEngines.forEach(name => {
        const engine = allEnginesFlat.find(e => e.name === name);
        if (engine && engine.parsable !== false) {
            parsableCount++;
        }
    });

    const launchCount = state.selectedEngines.size;

    dom.fusionCount.textContent = parsableCount;
    dom.fusionCount.classList.toggle('hidden', parsableCount === 0);

    dom.launchCount.textContent = launchCount;
    dom.launchCount.classList.toggle('hidden', launchCount === 0);
}

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
 * @param {'fusion' | 'launch'} mode
 */
function performSearch(mode) {
    const query = dom.searchInput.value.trim();

    if (!query && mode === 'fusion') {
        showToast('聚合搜索需要输入关键词', 'warning');
        return;
    }

    let targets = [];
    if (state.selectedEngines.size > 0) {
        const allEngines = Object.values(state.config.engines).flat();
        targets = allEngines.filter(e => state.selectedEngines.has(e.name));
    } else {
        if (mode === 'launch') {
            showToast('请先选择至少一个搜索引擎', 'warning');
            return;
        } else {
            const defaultCategory = state.currentCategory === 'all' ? 'search' : state.currentCategory;
            const pool = state.config.engines[defaultCategory] || [];
            targets = pool.slice(0, 3);
            if (targets.length > 0) {
                showToast(`未选择引擎，已为您使用默认引擎进行搜索`, 'info');
            }
        }
    }

    if (targets.length === 0) {
        showToast('未找到可用引擎，请尝试选择其他分类', 'error');
        return;
    }

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
        // "一键直达"：前端直接创建标签页，不进行资源拦截
        targets.forEach(eng => {
            const url = eng.url.replace('%s', encodeURIComponent(query));
            const shouldActivate = targets.length === 1;
            chrome.tabs.create({ url, active: shouldActivate });
        });
        showToast(`已为您打开 ${targets.length} 个页面`, 'success');
    } else {
        // "聚合搜索"：委托后台创建标签页，以便后台能及时应用资源拦截规则
        switchView('results');
        state.resultsPool = [];
        dom.resultsContainer.innerHTML = '';
        dom.resultsCountDisplay.textContent = '0';
        dom.skeleton.classList.remove('hidden');
        dom.emptyState.classList.add('hidden');
        dom.statusBar.classList.remove('hidden');
        dom.spinner.classList.remove('hidden');
        dom.statusText.textContent = `正在从 ${targets.length} 个来源聚合...`;

        targets.forEach((eng, index) => {
            setTimeout(() => {
                const url = buildSearchUrl(eng, query, searchId);
                // 向后台发送消息，请求创建并拦截资源
                chrome.runtime.sendMessage({
                    type: "CREATE_FUSION_TAB",
                    url: url
                });
            }, index * 200);
        });
    }
}

// === 结果处理 ===

function handleStorageChange(changes, area) {
    if (area !== 'local') return;

    for (let [key, { newValue }] of Object.entries(changes)) {
        if (!key.startsWith(`result_${state.currentSearchId}`)) continue;
        if (!newValue || newValue.length === 0) continue;

        renderResults(newValue);
        chrome.storage.local.remove(key);
    }
}

function renderResults(newResults) {
    dom.skeleton.classList.add('hidden');
    dom.emptyState.classList.add('hidden');

    const validItems = newResults.filter(r => !state.resultsPool.some(pool => pool.url === r.url));
    if (validItems.length === 0) return;

    state.resultsPool.push(...validItems);
    dom.resultsCountDisplay.textContent = state.resultsPool.length;

    const fragment = document.createDocumentFragment();
    validItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'result-card';

        // 优化：优先使用本地图标，提升视觉一致性
        const iconSrc = getBestIcon(item.source, item.url);

        div.innerHTML = `
            <div class="res-badge">
                <img src="${iconSrc}" class="res-icon" loading="lazy">
                ${item.source}
            </div>
            <a href="${item.url}" class="res-title" target="_blank" rel="noopener noreferrer">${item.title}</a>
            <div class="res-snippet">${item.snippet || '暂无摘要内容...'}</div>
        `;
        fragment.appendChild(div);
    });

    dom.resultsContainer.appendChild(fragment);

    dom.spinner.classList.add('hidden');
    dom.statusText.textContent = '聚合完成';
}

// === 辅助功能 ===

function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.dataset.theme = savedTheme;
}

function toggleTheme() {
    const currentTheme = document.body.dataset.theme;
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.dataset.theme = nextTheme;
    localStorage.setItem('theme', nextTheme);
}

// === 应用启动 ===
document.addEventListener('DOMContentLoaded', init);