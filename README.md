# SearchFusion 🚀

> **一个页面，聚合多个搜索引擎的浏览器插件**
> Multi-Engine Search Aggregation Extension

SearchFusion 是一个基于 **Chrome Extension（Manifest V3）** 的浏览器插件。它提供一个类似 Google 首页的统一搜索页面，通过下拉框选择不同搜索引擎，在**新标签页打开搜索结果**的同时，**拦截并解析搜索请求与返回数据**，将多搜索引擎的结果聚合展示在当前插件页面中。

---

## ✨ 项目目标

* 🔍 **一个页面使用多个搜索引擎**（Google / Bing / Baidu / DuckDuckGo 等）
* 🧭 提供类似 Google 首页的极简搜索体验
* 🧩 通过插件拦截网络请求，解析搜索结果数据
* 📊 将不同搜索引擎的结果结构化并统一呈现
* 🧠 为后续 AI 搜索 / 总结 / 重排提供基础能力

---

## 🧱 核心功能

### 1️⃣ 统一搜索首页

* 默认新标签页（New Tab）样式
* 搜索框 + 搜索引擎下拉选择
* 支持键盘回车搜索

### 2️⃣ 多搜索引擎支持

* 可配置搜索引擎列表
* 每个搜索引擎独立：

    * 搜索 URL 模板
    * 请求参数规则
    * 结果解析规则

示例：

```json
{
  "name": "Google",
  "key": "google",
  "searchUrl": "https://www.google.com/search?q=%s"
}
```

### 3️⃣ 新标签页打开原始搜索

* 搜索时：

    * 当前插件页用于结果聚合展示
    * 同时新开 Tab 打开原始搜索引擎页面

### 4️⃣ 网络请求拦截与数据提取

* 利用 `chrome.webRequest` / `declarativeNetRequest`
* 捕获搜索请求与响应数据
* 针对 HTML / JSON 响应进行解析

### 5️⃣ 搜索结果聚合展示

* 将不同搜索引擎的结果统一为标准结构：

```ts
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string; // google / bing / baidu ...
}
```

* 在插件页面中按引擎分组或混合排序展示

---

## 🧠 实现方案

### 📦 技术栈

* **Chrome Extension (Manifest V3)**
* **HTML / CSS / JavaScript (ES Modules)**
* 可选：

    * Vue / React（用于 UI）
    * TypeScript

---

### 🏗️ 架构设计

```
searchfusion-extension
├── manifest.json
├── newtab/
│   ├── index.html        # 搜索首页
│   ├── main.js           # UI 逻辑
│   └── style.css
├── background/
│   └── serviceWorker.js  # 请求拦截与调度
├── content-scripts/
│   └── parser.js         # 页面结果解析
├── engines/
│   ├── google.js
│   ├── bing.js
│   └── baidu.js
└── utils/
    └── normalize.js      # 结果标准化
```

---

### 🔄 搜索流程

1. 用户在插件首页输入关键词
2. 选择搜索引擎（或多选）
3. 插件：

    * 新开标签页访问搜索引擎
    * 后台监听对应网络请求
4. Content Script 注入页面
5. 提取 DOM / JSON 数据
6. 转换为统一结果结构
7. 回传至插件页面展示

---

### 🔌 请求拦截方式

#### 方案一：Content Script DOM 解析（推荐）

* 注入搜索结果页
* 解析 DOM 结构
* 稳定性较高，权限要求低

#### 方案二：webRequest 拦截响应

* 适用于 JSON 接口型搜索
* 精度高，但受限于 CORS 与权限

---

## 🔐 权限说明

```json
{
  "permissions": [
    "tabs",
    "storage",
    "scripting",
    "webRequest"
  ],
  "host_permissions": [
    "https://www.google.com/*",
    "https://www.bing.com/*"
  ]
}
```

仅在搜索行为发生时使用相关权限。

---

## 🚧 开发计划（Roadmap）

* [x] 搜索首页 UI
* [x] 多引擎配置结构
* [ ] Google / Bing 解析器
* [ ] 结果聚合展示
* [ ] 搜索历史记录
* [ ] AI 搜索总结（可选）
* [ ] 自定义搜索引擎配置

---

## 🌱 未来扩展

* 🤖 接入 LLM 进行搜索结果总结
* 🧠 多引擎结果智能重排
* 📑 搜索结果快照 / 笔记
* 🌐 与 Electron 浏览器集成

---

## 📄 License

MIT License

---

## 🙌 说明

本项目仅用于学习与研究浏览器插件、搜索聚合与网络请求分析，请遵守各搜索引擎的使用条款。
