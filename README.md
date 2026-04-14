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
- 图片调用 DeerAPI 的 Gemini 生图接口
- 全部结果保存在本地目录
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
IMAGE_MODEL=gemini-3.1-flash-image-preview
OUTPUT_DIR=./output
```

### 字段说明

- `DEERAPI_BASE_URL`：DeerAPI 根地址
- `DEERAPI_API_KEY`：你的 API Key
- `TEXT_MODEL`：用于生成大纲、正文、配图提示词的文本模型
- `IMAGE_MODEL`：用于生成配图的 Gemini 图像模型
- `OUTPUT_DIR`：本地输出目录，默认项目下 `output/`

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

- 图片接口使用 DeerAPI 文档里的 Gemini 生图方案：
  - `POST /v1beta/models/{model}:generateContent`
- 如果某一张图生成失败，文章正文仍然会保存成功
- 页面上的图片预览来自本次返回的 base64，真正文件仍会保存在本地 `output/` 中
- 本项目是单机 demo，不包含账号系统、数据库和自动发布
