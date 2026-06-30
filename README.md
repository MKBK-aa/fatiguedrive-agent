# FatigueDrive-Agent

基于 Qwen-VL 的疲劳驾驶多模态识别智能体。用户上传驾驶员图片，系统调用阿里云百炼 OpenAI 兼容接口，按眼睛、嘴部、头部姿态、表情和身体坐姿生成疲劳风险报告。

## 文件结构

```text
fatiguedrive-agent/
├── index.html
├── style.css
├── script.js
├── DESIGN.md
```

## 本地运行

直接双击 `index.html` 即可打开。

```powershell




## 使用方法

1. 输入阿里云百炼 API Key。新创建的 Key 可能以 `sk-ws` 开头，旧 Key 可能以 `sk-` 开头。
2. 选择已经开通权限的 Qwen-VL 模型。
3. 上传驾驶员状态图片。
4. 填写驾驶场景说明。
5. 点击“开始分析”。

## 安全说明

- API Key 只在浏览器请求中使用，不写入代码。

