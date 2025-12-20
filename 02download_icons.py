import json
import os
import requests
from urllib.parse import urlparse
import re

# 配置路径
JSON_FILE_PATH = os.path.join('engines', 'engines.json')
ICONS_DIR = os.path.join('assets', 'icons')

# Google S2 Favicon 服务 (sz=64 代表获取 64x64 的图标)
FAVICON_API = "https://www.google.com/s2/favicons?domain={domain}&sz=64"

def load_engines():
    """读取 JSON 配置文件"""
    if not os.path.exists(JSON_FILE_PATH):
        print(f"❌ 错误: 找不到文件 {JSON_FILE_PATH}")
        return None
    
    with open(JSON_FILE_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

def sanitize_filename(name):
    """将引擎名称转换为合法的文件名"""
    # 移除非字母数字字符（保留空格和下划线）
    clean_name = re.sub(r'[^\w\s-]', '', name)
    # 将空格替换为下划线并转小写
    return clean_name.strip().replace(' ', '_').lower() + ".png"

def get_domain(url_string):
    """从搜索链接中提取域名"""
    # 移除 %s 占位符，防止 urlparse 报错
    clean_url = url_string.replace('%s', '')
    try:
        parsed = urlparse(clean_url)
        return parsed.netloc
    except:
        return None

def download_icon(name, url):
    """下载图标并保存"""
    domain = get_domain(url)
    if not domain:
        print(f"⚠️ 跳过 {name}: 无法解析域名")
        return

    request_url = FAVICON_API.format(domain=domain)
    filename = sanitize_filename(name)
    save_path = os.path.join(ICONS_DIR, filename)

    # 如果文件已存在，可以选择跳过
    # if os.path.exists(save_path):
    #     print(f"⏭️ 跳过 {name}: 文件已存在")
    #     return

    try:
        response = requests.get(request_url, timeout=10)
        if response.status_code == 200:
            with open(save_path, 'wb') as f:
                f.write(response.content)
            print(f"✅ 已下载: {name} -> {filename}")
        else:
            print(f"❌ 失败 {name}: HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ 错误 {name}: {e}")

def main():
    # 1. 创建目录
    if not os.path.exists(ICONS_DIR):
        os.makedirs(ICONS_DIR)
        print(f"📂 创建目录: {ICONS_DIR}")

    # 2. 加载数据
    data = load_engines()
    if not data or 'engines' not in data:
        print("❌ JSON 数据格式不正确")
        return

    # 3. 遍历下载
    total_count = 0
    engines_map = data['engines']
    
    print("🚀 开始下载图标...")
    
    for category, engines in engines_map.items():
        print(f"\n--- 处理分类: {category} ---")
        for engine in engines:
            name = engine.get('name')
            url = engine.get('url')
            if name and url:
                download_icon(name, url)
                total_count += 1

    print(f"\n🎉 任务完成！共处理 {total_count} 个图标。")
    print(f"图标已保存在: {os.path.abspath(ICONS_DIR)}")

if __name__ == "__main__":
    main()