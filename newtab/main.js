/**
 * newtab/main.js
 * 前端核心逻辑 (Modern UI 重构版)
 *
 * [vNext 修复]
 * - 修复了 Manifest V3 中因内容安全策略 (CSP) 限制，
 *   导致 <img onerror="..."> 内联事件处理器失效的问题。
 * - 解决方案: 采用全局事件委托 (event delegation) 的方式，
 *   在捕获阶段监听所有图片的 `error` 事件，从而实现默认图片的优雅降级，
 *   此方法符合 CSP 要求且性能更优。
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
    bindImageErrorFallback(); // [核心修改] 绑定图片加载失败的全局处理逻辑

    // 4. 初始化主题
    initTheme();

    // 5. 监听结果变动 (来自 Background/Content Scripts)
    chrome.storage.onChanged.addListener(handleStorageChange);

    // 6. 清理旧数据 (启动时清理上一次未完成的搜索结果)
    chrome.storage.local.get(null, (items) => {
        const keys = Object.keys(items).filter(k => k.startsWith('result_'));
        if (keys.length) chrome.storage.local.remove(keys);
    });

    // 7. 处理窗口大小变化，适配移动端/桌面端视图
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
    // 构造包含 "全部" 的列表
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

    // 筛选需展示的分类
    const catsToShow = category === 'all'
        ? state.config.categories
        : state.config.categories.filter(c => c.value === category);

    catsToShow.forEach(cat => {
        const engines = state.config.engines[cat.value];
        if (!engines || engines.length === 0) return;

        // 创建分类组容器
        const group = document.createElement('div');
        group.className = 'category-group';

        // 分类标题
        group.innerHTML = `
            <div class="group-title" id="cat-${cat.value}">
                <span>${cat.icon}</span> ${cat.label}
            </div>
        `;

        // 网格容器
        const grid = document.createElement('div');
        grid.className = 'grid-container';

        engines.forEach(eng => {
            const isSelected = state.selectedEngines.has(eng.name);
            const card = document.createElement('div');

            card.className = `engine-card ${isSelected ? 'selected' : ''}`;
            card.dataset.name = eng.name;

            const iconPath = getLocalEngineIcon(eng.name);

            // [核心修改] 移除了 onerror 属性，改为通过全局事件监听处理错误
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
 * 规则需与 Python 下载脚本保持一致：
 * 1. 移除特殊字符
 * 2. 替换空格为下划线
 * 3. 转小写
 */
function getLocalEngineIcon(engineName) {
    if (!engineName) return ''; // 返回空字符串，让它触发加载错误，由全局处理器接管
    const filename = engineName
        .replace(/[^\w\s\u4e00-\u9fa5]/g, '')
        .trim()
        .replace(/\s+/g, '_')     // 空格转下划线
        .toLowerCase();           // 转小写
    return `../assets/icons/${filename}.png`;
}

/**
 * 获取远程 Favicon (用于搜索结果列表)
 * 搜索结果是动态 URL，无法预下载，因此继续使用 Google S2 服务
 */
function getRemoteFavicon(targetUrl) {
    try {
        const domain = new URL(targetUrl.replace('%s', '')).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch (e) {
        return ''; // 返回空字符串，让它触发加载错误，由全局处理器接管
    }
}

// === 交互逻辑 (Controller) ===

function bindEvents() {
    // 侧边栏切换 (分类)
    dom.categoryList.addEventListener('click', (e) => {
        const item = e.target.closest('.nav-item');
        if (!item) return;

        // UI 更新
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');

        // 逻辑更新
        const cat = item.dataset.cat;
        state.currentCategory = cat;
        renderEngineGrid(cat);
        switchView('grid'); // 切换分类后，强制返回引擎选择视图

        // 移动端：选完自动关闭菜单
        if (state.isMobile) toggleSidebar(false);
    });

    // 移动端菜单开关
    dom.btnOpenSidebar.addEventListener('click', () => toggleSidebar(true));
    dom.btnCloseSidebar.addEventListener('click', () => toggleSidebar(false));
    dom.sidebarOverlay.addEventListener('click', () => toggleSidebar(false));

    // 搜索相关
    dom.btnLaunch.addEventListener('click', () => performSearch('launch'));
    dom.btnFusion.addEventListener('click', () => performSearch('fusion'));
    dom.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') performSearch('fusion');
    });

    // 清空按钮逻辑
    dom.searchInput.addEventListener('input', (e) => {
        if (e.target.value.trim()) dom.btnClear.classList.remove('hidden');
        else dom.btnClear.classList.add('hidden');
    });
    dom.btnClear.addEventListener('click', () => {
        dom.searchInput.value = '';
        dom.btnClear.classList.add('hidden');
        dom.searchInput.focus();
    });

    // 返回按钮
    dom.btnBack.addEventListener('click', () => switchView('grid'));

    // 主题切换
    dom.themeBtn.addEventListener('click', toggleTheme);
}

/**
 * [核心修改] 使用事件委托处理图片加载失败
 * 这是替代内联 onerror 的标准做法，以符合 MV3 的内容安全策略。
 */
function bindImageErrorFallback() {
    // 监听整个文档的图片错误事件，使用捕获阶段以确保优先处理
    document.addEventListener('error', (e) => {
        const target = e.target;
        // 确保错误源是图片元素
        if (target && target.tagName === 'IMG') {
            // 为 engine-card 中的图标设置默认图
            if (target.classList.contains('engine-icon')) {
                target.src = '../assets/default.svg';
            }
            // 为 result-card 中的网站 favicon 设置默认图
            else if (target.classList.contains('res-icon')) {
                target.src = '../assets/default.svg';
            }
            // 为防止默认图片也加载失败导致无限循环，不再监听该元素的错误
            target.onerror = null;
        }
    }, true); // `true` 表示在捕获阶段执行
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
    const count = state.selectedEngines.size;
    if (count > 0) {
        dom.fusionCount.textContent = count;
        dom.launchCount.textContent = count;
        dom.fusionCount.classList.remove('hidden');
        dom.launchCount.classList.remove('hidden');
    } else {
        dom.fusionCount.classList.add('hidden');
        dom.launchCount.classList.add('hidden');
    }
}

function switchView(viewName) {
    if (viewName === 'results') {
        dom.engineView.classList.add('hidden');
        dom.engineView.classList.remove('active');
        dom.resultsView.classList.remove('hidden');
        // 使用微小的延时来确保 CSS 过渡动画能够触发
        setTimeout(() => dom.resultsView.classList.add('active'), 10);
    } else {
        dom.resultsView.classList.remove('active');
        dom.resultsView.classList.add('hidden');
        dom.engineView.classList.remove('hidden');
        setTimeout(() => dom.engineView.classList.add('active'), 10);
    }
}

// === 搜索核心逻辑 ===

function performSearch(mode) {
    const query = dom.searchInput.value.trim();
    if (!query) {
        showToast('请输入搜索关键词', 'warning');
        return;
    }

    // 获取目标引擎：优先使用用户选择的，若无选择则智能推荐当前分类下的前3个
    let targets = [];
    if (state.selectedEngines.size > 0) {
        Object.values(state.config.engines).flat().forEach(e => {
            if (state.selectedEngines.has(e.name)) targets.push(e);
        });
    } else {
        // 智能默认：如果当前在“全部”，则用“搜索”分类；否则用当前分类
        const defaultCategory = state.currentCategory === 'all' ? 'search' : state.currentCategory;
        const pool = state.config.engines[defaultCategory] || [];
        targets = pool.slice(0, 3);
    }

    if (targets.length === 0) {
        showToast('未找到可用引擎，请尝试选择其他分类', 'error');
        return;
    }

    const searchId = Date.now().toString(36);
    state.currentSearchId = searchId;

    if (mode === 'launch') {
        // 直达模式：为每个引擎在后台新开标签页
        targets.forEach(eng => {
            const url = buildSearchUrl(eng, query, searchId);
            chrome.tabs.create({ url, active: false });
        });
        showToast(`已在后台为您打开 ${targets.length} 个页面`, 'success');

    } else {
        // 聚合模式：在本页展示结果
        switchView('results');

        // 重置UI状态
        state.resultsPool = [];
        dom.resultsContainer.innerHTML = '';
        dom.resultsCountDisplay.textContent = '0';
        dom.skeleton.classList.remove('hidden');
        dom.emptyState.classList.add('hidden');
        dom.statusBar.classList.remove('hidden');
        dom.spinner.classList.remove('hidden');
        dom.statusText.textContent = `正在从 ${targets.length} 个来源聚合...`;

        // 批量创建搜索任务，使用延时防止浏览器瞬间负载过高
        targets.forEach((eng, index) => {
            setTimeout(() => {
                const url = buildSearchUrl(eng, query, searchId);
                chrome.tabs.create({ url, active: false });
            }, index * 200); // 每个任务间隔 200ms
        });
    }
}

// === 结果处理 ===

function handleStorageChange(changes, area) {
    if (area !== 'local') return;

    for (let [key, { newValue }] of Object.entries(changes)) {
        // 校验是否为当前搜索任务的结果
        if (!key.startsWith(`result_${state.currentSearchId}`)) continue;
        if (!newValue || newValue.length === 0) continue;

        renderResults(newValue);

        // 收到数据后立即从 storage 中移除，避免数据陈旧和占用空间
        chrome.storage.local.remove(key);
    }
}

function renderResults(newResults) {
    // 首次收到结果时，隐藏加载骨架屏
    dom.skeleton.classList.add('hidden');
    dom.emptyState.classList.add('hidden');

    // 客户端去重，防止不同引擎返回相同URL
    const validItems = newResults.filter(r => !state.resultsPool.some(pool => pool.url === r.url));
    if (validItems.length === 0) return;

    state.resultsPool.push(...validItems);
    dom.resultsCountDisplay.textContent = state.resultsPool.length;

    // 使用 DocumentFragment 批量插入DOM，提升性能
    const fragment = document.createDocumentFragment();
    validItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'result-card';
        const favicon = getRemoteFavicon(item.url);

        // [核心修改] 移除了 onerror 属性
        div.innerHTML = `
            <div class="res-badge">
                <img src="${favicon}" class="res-icon">
                ${item.source}
            </div>
            <a href="${item.url}" class="res-title" target="_blank">${item.title}</a>
            <div class="res-snippet">${item.snippet || '暂无摘要内容...'}</div>
        `;
        fragment.appendChild(div);
    });

    dom.resultsContainer.appendChild(fragment);

    // 更新状态栏文本，此处可扩展为显示“已完成 N/M”
    dom.spinner.classList.add('hidden');
    dom.statusText.textContent = '聚合完成';
}

// === 辅助功能 ===

function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    dom.toastContainer.appendChild(toast);

    // 3秒后自动消失
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        // 在动画结束后移除DOM元素
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function initTheme() {
    // 优先从本地存储读取主题设置，若无则默认为 'light'
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
init();