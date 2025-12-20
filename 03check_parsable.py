import json
import os
import re
import requests
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from bs4 import BeautifulSoup

# ================= 配置区域 =================

# 你的本地代理地址 (如果 json 中 proxy: true，将使用此地址)
PROXY_URL = "http://127.0.0.1:7890"

# 并发线程数
THREAD_COUNT = 8

# 指定需要检测的分类列表
# 格式: ["分类名1", "分类名2"]
# 如果列表为空 [] 或 None，则处理所有分类
TARGET_CATEGORIES = ["video"]
# TARGET_CATEGORIES = []  # 解开此行注释以处理所有分类

# 文件路径设置
JSON_PATH = os.path.join("engines", "engines.json")
SAVE_DIR_ROOT = os.path.join("engines", "page")

# 伪装 User-Agent
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

# 关键词池 (当首个关键词无法解析时，尝试后续关键词)
KEYWORDS_POOL = [
    "boy", "a", "flower", "sky", "cat",
    "test", "hello", "123", "news", "movie"
]

# 线程锁 (用于控制台打印不乱序)
print_lock = threading.Lock()

# ===========================================

def ensure_dir(directory):
    """确保目录存在，线程安全"""
    if not os.path.exists(directory):
        try:
            os.makedirs(directory, exist_ok=True)
        except Exception:
            pass

def sanitize_filename(name):
    """将引擎名称转换为合法的文件名"""
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    return name.strip().replace(" ", "_")

def clean_html(html_content):
    """移除 style, script, svg 等干扰阅读的标签"""
    if not html_content:
        return ""
    try:
        soup = BeautifulSoup(html_content, "html.parser")
        for tag in soup(["style", "script", "svg", "noscript", "iframe", "link", "meta"]):
            tag.decompose()
        return soup.prettify()
    except Exception:
        return html_content

def check_is_parsable(html_content):
    """
    启发式判断：检查页面是否有足够的有效内容
    """
    if not html_content or len(html_content) < 500:
        return False
    try:
        soup = BeautifulSoup(html_content, "html.parser")
        # 检查正文中是否有一定数量的链接
        links = soup.find_all("a")
        # 至少有 5 个链接才认为大概率加载成功且非空页面
        return len(links) > 5
    except Exception:
        return False

def save_snapshot(category, name, content, raw_url, parsable_status):
    """保存 HTML 快照到分类目录下"""
    try:
        # 构建分类子目录: engines/page/category/
        cat_dir = os.path.join(SAVE_DIR_ROOT, category)
        ensure_dir(cat_dir)

        safe_name = sanitize_filename(name)
        file_path = os.path.join(cat_dir, f"{safe_name}.html")
        # cleaned_content = clean_html(content)

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content or "")
    except Exception as e:
        print(f"[警告] 文件保存失败 {name}: {e}")

def process_engine(task_data):
    """
    单个引擎的处理逻辑
    task_data: (category_name, engine_config_dict)
    """
    category, engine_config = task_data

    name = engine_config.get("name")
    raw_url_template = engine_config.get("url")
    use_proxy = engine_config.get("proxy", False)

    if not raw_url_template:
        return engine_config, None, f"[{name}] 跳过(无URL)"

    # 配置代理
    proxies = None
    if use_proxy and PROXY_URL:
        proxies = {"http": PROXY_URL, "https": PROXY_URL}

    result_parsable = False
    final_status_msg = ""
    last_content = "" # 用于保存最后一次请求的内容（即使失败）
    last_url = ""

    # 循环尝试关键词
    for idx, keyword in enumerate(KEYWORDS_POOL):
        try:
            target_url = raw_url_template.replace("%s", keyword)
            last_url = target_url

            # 发起请求
            response = requests.get(
                target_url,
                headers=HEADERS,
                proxies=proxies,
                timeout=15
            )

            # 自动处理编码
            response.encoding = response.apparent_encoding
            current_content = response.text
            last_content = current_content

            # 检查 HTTP 状态
            if response.status_code == 200:
                is_parsable_now = check_is_parsable(current_content)
                save_snapshot(category, name, current_content, target_url, is_parsable_now)

                # 检查内容是否可解析
                if is_parsable_now:
                    result_parsable = True
                    final_status_msg = f"成功 (关键词: '{keyword}')"
                    # 成功后立即保存并跳出循环
                    break
                else:
                    # 状态码200但内容解析失败，继续尝试下一个词
                    if idx == len(KEYWORDS_POOL) - 1:
                        final_status_msg = f"解析失败 (已重试 {len(KEYWORDS_POOL)} 次)"
            else:
                if idx == len(KEYWORDS_POOL) - 1:
                    final_status_msg = f"HTTP Error {response.status_code}"

        except Exception as e:
            if idx == len(KEYWORDS_POOL) - 1:
                final_status_msg = f"请求异常: {str(e)[:30]}..."

        # 可以在此处添加 time.sleep(1) 以减轻服务器压力

    # 如果所有关键词都失败了，保存最后一次的结果用于排查
    if not result_parsable:
        pass

    # 打印进度
    with print_lock:
        # 使用简单的符号标识状态：√ 成功, × 失败
        icon = "√" if result_parsable else "×"
        print(f"[{icon}] {name:<10} | {final_status_msg}")

    return engine_config, result_parsable

def main():
    # 1. 初始化
    ensure_dir(SAVE_DIR_ROOT)

    if not os.path.exists(JSON_PATH):
        print(f"[错误] 找不到配置文件: {JSON_PATH}")
        return

    print(f"[系统] 加载配置: {JSON_PATH}")
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        config = json.load(f)

    engines_map = config.get("engines", {})

    # 2. 筛选需要处理的分类
    target_keys = engines_map.keys()

    if TARGET_CATEGORIES and len(TARGET_CATEGORIES) > 0:
        # 取交集，确保只处理配置文件中实际存在的分类
        target_keys = [k for k in TARGET_CATEGORIES if k in engines_map]
        if not target_keys:
            print(f"[警告] 指定的分类 {TARGET_CATEGORIES} 在配置文件中未找到任何匹配项！")
            return
        print(f"[系统] 仅处理以下分类: {target_keys}")
    else:
        print("[系统] 处理所有分类")

    # 3. 构建任务列表
    all_tasks = []
    for category in target_keys:
        engine_list = engines_map[category]
        for engine in engine_list:
            all_tasks.append((category, engine))

    total_engines = len(all_tasks)
    print(f"[系统] 开始处理 {total_engines} 个引擎，使用 {THREAD_COUNT} 个线程")
    print(f"[系统] 每个引擎最多尝试 {len(KEYWORDS_POOL)} 个关键词...\n")

    start_time = time.time()

    # 4. 线程池并发执行
    success_count = 0
    updated_count = 0

    with ThreadPoolExecutor(max_workers=THREAD_COUNT) as executor:
        # 提交任务
        future_to_task = {executor.submit(process_engine, task): task for task in all_tasks}

        # 获取结果
        for future in as_completed(future_to_task):
            engine_ref, is_parsable = future.result()

            # 5. 更新内存中的配置对象
            if is_parsable is not None:
                # 只有当该引擎属于我们此次运行的任务列表时，才会更新它的 parsable 状态
                # 注意：这里直接修改了内存中的 dict 引用
                updated_count += 1
                if is_parsable:
                    success_count += 1

    end_time = time.time()
    duration = end_time - start_time

    # 6. 写回 engines.json
    print(f"\n[系统] 任务完成。耗时: {duration:.2f}秒")
    print(f"[系统] 本次更新引擎数: {updated_count}")
    print(f"[系统] 其中可解析数: {success_count}")
    print(f"[系统] 样本文件已保存至: {SAVE_DIR_ROOT} (按分类存储)")
    print("[系统] 本脚本不会修改 engines.json。")

if __name__ == "__main__":
    main()