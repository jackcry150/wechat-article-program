# 微信公众号图文生成器（本地 Web Demo）

一个本地运行的 Web 软件：输入公众号文章主题和少量要求，自动生成文章大纲、正文和配图，并把所有结果保存到本地目录，最后由你手动上传到公众号后台发布。

## 功能范围

- 输入文章主题、风格、读者、长度、图片数量等参数
- 自动生成：
  - `outline.md`
  - `article.md`
  - `article.html`
  - `metadata.json`
  - `prompts/*.txt`
  - `images/*.png`
- 图片调用 DeerAPI 的 OpenAI 图像生成接口，默认模型为 `gpt-image-2`
- 全部结果保存到本地目录
- 不自动发布公众号，只做本地生成和预览

## 技术栈

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS

## 环境变量

复制 `.env.example` 为 `.env`，然后填写：

```bash
cp .env.example .env
```

`.env` 示例：

```env
DEERAPI_BASE_URL=https://api.deerapi.com
DEERAPI_API_KEY=你的 DeerAPI Key
TEXT_MODEL=gpt-4.1-mini
IMAGE_MODEL=gpt-image-2
IMAGE_OUTPUT_FORMAT=png
IMAGE_SIZE=auto
IMAGE_QUALITY=auto
OUTPUT_DIR=./output
POOL_DIR=./pool
KNOWLEDGE_DIR=./knowledge
PORT=3000
XHS_CLI_COMMAND=xhs
XHS_COOKIE_SOURCE=auto
```

### 字段说明

- `DEERAPI_BASE_URL`：DeerAPI 根地址
- `DEERAPI_API_KEY`：你的 API Key
- `TEXT_MODEL`：用于生成大纲、正文、配图提示词的文本模型
- `IMAGE_MODEL`：用于生成配图的图像模型，默认 `gpt-image-2`
- `IMAGE_OUTPUT_FORMAT`：保存图片格式，默认 `png`
- `IMAGE_SIZE`：可选图片尺寸；不确定时用 `auto`
- `IMAGE_QUALITY`：可选图片质量；不确定时用 `auto`
- `OUTPUT_DIR`：本地输出目录，默认项目中的 `output/`
- `POOL_DIR`：历史结果索引目录，默认项目中的 `pool/`
- `KNOWLEDGE_DIR`：知识库目录，默认项目中的 `knowledge/`
- `PORT`：本地 Web 服务端口，默认 `3000`
- `XHS_CLI_COMMAND`：小红书 CLI 命令名或完整路径，macOS/Linux 默认用 `xhs`，Windows 可用 `xhs.cmd`
- `XHS_COOKIE_SOURCE`：读取小红书登录 Cookie 的浏览器来源，可填 `auto`、`edge`、`chrome`、`firefox`、`brave` 等

如果你想把生成内容直接写到 NAS，可以把这些路径改成绝对路径，例如：

```env
OUTPUT_DIR=/Volumes/运营部/公众号推文/output
POOL_DIR=/Volumes/运营部/公众号推文/pool
KNOWLEDGE_DIR=/Volumes/运营部/公众号推文/knowledge
```

建议：

- `OUTPUT_DIR`：非常适合放 NAS
- `POOL_DIR`：适合放 NAS，便于沉淀历史结果
- `KNOWLEDGE_DIR`：可以放 NAS，但如果你频繁编辑，保留本地通常更稳

## 本地运行

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

打开：

```text
http://localhost:3000
```

如果 `.env` 中把 `PORT` 改成其他值，例如 `3001`，访问地址也对应改为 `http://localhost:3001`。

## 小红书热点

项目已接入 [`xiaohongshu-cli`](https://github.com/jackwener/xiaohongshu-cli)，页面顶部可以检查登录状态、从本机浏览器导入登录态、拉取分类热门和按关键词搜索。

使用前需要先在本机安装并确保命令可用：

```bash
uv tool install xiaohongshu-cli
```

如果需要二维码登录，可以直接点击页面里的“扫码登录”，也可以在终端运行：

```bash
xhs login --qrcode
```

Web 页面里的“导入浏览器登录”会执行 `xhs login --json`，前提是你已经在本机浏览器登录过小红书。如果自动检测失败，把 `.env` 里的 `XHS_COOKIE_SOURCE` 改成你实际登录小红书的浏览器，例如 `edge` 或 `chrome`，然后重启 `npm run dev`。

如果本机浏览器里没有可读取的小红书登录态，请使用 QR 登录：点击页面里的“扫码登录”或在终端运行 `xhs login --qrcode`。首次 QR 登录会下载 Camoufox 浏览器运行时，下载完成后会弹出登录窗口；扫码成功后回到页面点击“检查登录”。

## 构建检查

```bash
npm run build
npm run lint
```

## 输出目录结构

每次生成会创建一个独立目录，形如：

```text
output/
  2026-04-12_13-30-00_ai-gongzhonghao-demo/
    article.md
    article.html
    outline.md
    metadata.json
    prompts/
      outline_prompt.txt
      article_prompt.txt
      image_planner_prompt.txt
      image_prompt_1.txt
    images/
      cover.png
      image_1.png
      image_2.png
```

## 注意事项

- 图片接口使用 DeerAPI 文档里的 OpenAI 图像生成方案：
  - `POST /v1/images/generations`
- `gpt-image-2` 默认返回 `data[].b64_json`，项目会解码后写入本地图片文件
- 如果某一张图生成失败，文章正文仍然会保存成功
- 页面上的图片预览来自本次返回的 base64，真实文件也会保存到本地 `output/` 中
- 本项目是单机 demo，不包含账号系统、数据库和自动发布
