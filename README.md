# 人生推演仪 · Life Simulator

三个大模型分别扮演**执行者**、**教练**与**现实环境**，在循环推演中模拟一段人生轨迹：教练定规划，执行者行动，环境给出真实反馈——机会、挫折、意外与时间流逝，直到目标达成或轮次耗尽。

## 功能

- **三智能体循环推演**：教练（规划/总结）、执行者（行动/记录）、环境（现实反馈 + 客观世界状态判定）
- **时间跨度可调**：「节奏快 · 约3年」（每轮 2-16 周）或「按季度 · 约5年」（每轮约一个季度），年龄按累计周数精确折算
- **自定义模型**：三个角色可分别选择服务商内置模型，也可直接输入任意模型 ID
- **多服务商**：OpenRouter 免费池 / 魔搭 ModelScope（均已验证支持浏览器直连）；NVIDIA NIM 因 CORS 限制需自建代理
- **断点续推**：推演中断后可从已完成轮次继续
- **历史存档**：推演自动保存在浏览器本地，可回看分阶段历程
- **推演广场**：把任意一次推演编码成分享链接，任何人打开即可查看完整历程，无需服务器

## 运行

```bash
npm install
npm run dev
```

浏览器打开 http://localhost:5173，填入 API Key 即可开始。

### 可选：本地 key 预填

复制以下内容到项目根目录 `.env.local`（已被 `.gitignore` 忽略，不会提交）：

```
VITE_NVIDIA_KEY=你的key
VITE_OPENROUTER_KEY=你的key
VITE_MODELSCOPE_KEY=你的key
```

> **警告**：Vite 的 `VITE_*` 变量会打包进前端产物。**公开部署前请清空/删除 `.env.local` 再构建**，否则你的 key 会随构建产物泄露给所有访问者。

## 部署（GitHub Pages 等静态托管）

本项目为**纯前端应用**：推演引擎、LLM 调用、分享编码全部在浏览器中完成，无需任何后端服务器。

```bash
npm run build
# 产物在 dist/ ，将 dist/ 部署到任意静态托管即可
```

- 已配置 `base: './'` 与 hash 路由，可直接部署在仓库子路径（如 `username.github.io/life-simulator/`）
- 访问者需自行填写自己的 API Key
- 推荐使用 **OpenRouter** 或 **ModelScope**（浏览器直连无 CORS 问题）；NVIDIA NIM 会被浏览器 CORS 拦截

## 隐私与安全

- **API Key 只存在于访问者自己的浏览器内存中**，仅在推演时用于直连模型服务商（OpenRouter / ModelScope 等），不经过任何中间服务器，不写入任何数据库
- **本地历史存档**保存在浏览器 `localStorage`，只包含推演内容，不包含 key
- **分享链接**只编码推演内容（人生设定、各轮规划与结果、总结报告），**永远不包含 API Key**，也没有任何人能看到你输入的 key
- 因此：在网上访问本站、填上自己的 key 进行推演，**key 不会被记录、不会被公开**

## 技术栈

React 18 + TypeScript + Vite + Tailwind CSS + Zustand + React Router（hash 模式）

```
src/
├── lib/
│   ├── prompts.ts      # 三个智能体的系统提示词（时间尺度动态注入）
│   ├── llm.ts          # OpenAI 兼容 API 浏览器直连客户端（重试/退避）
│   ├── engine.ts       # 推演引擎：规划→行动→反馈→记录 循环
│   ├── share.ts        # 分享码编码/解码（gzip + base64url）
│   ├── history.ts      # localStorage 历史存档
│   └── models.ts       # 服务商与模型清单
├── store/simStore.ts   # 推演状态机
└── pages/              # Setup / Simulate / Journey / History / Gallery
```
