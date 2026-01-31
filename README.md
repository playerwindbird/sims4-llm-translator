# 🎮 Sims 4 LLM Translator

一款基于 LLM（大语言模型）的模拟人生 4 本地化 XML 文件翻译工具。

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?logo=tailwindcss&logoColor=white)

## ✨ 功能特性

- **📄 XML 文件解析**：支持导入 The Sims 4 Translator 导出的 XML 本地化文件
- **🤖 双模式翻译**：
  - **手动模式**：复制 JSON 到外部 LLM 工具进行翻译，再粘贴回结果
  - **自动模式**：配置 API 后自动调用 LLM 进行批量翻译
- **📊 批量处理**：支持自定义每批处理的条目数量，优化翻译效率
- **🔴 缺失检测**：自动检测未翻译的字段并高亮显示
- **💾 导出功能**：一键导出与源文件格式一致的翻译后 XML 文件
- **🌐 纯前端运行**：完全在浏览器本地运行，无需服务端，保护数据隐私

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 或其他包管理器

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/yourusername/sims4-llm-translator.git
cd sims4-llm-translator

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

开发服务器启动后，访问 `http://localhost:5173` 即可使用。

### 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist` 目录。

## 📖 使用指南

### 1. 导入 XML 文件

点击上传区域或拖拽 The Sims 4 Translator 导出的 XML 文件到页面中。工具会自动解析文件内容，提取所有待翻译的字符串。

### 2. 选择翻译模式

#### 手动模式

1. 设置每批处理的条目数量
2. 点击「复制源 JSON」将待翻译内容复制到剪贴板
3. 将 JSON 粘贴到您喜欢的 LLM 工具（如 ChatGPT、Claude 等）
4. 复制 LLM 返回的翻译结果
5. 粘贴到「粘贴翻译后的 JSON」输入框中
6. 重复以上步骤直到所有内容翻译完成

#### 自动模式

1. 配置 API 设置：
   - API 地址（支持 OpenAI 兼容接口）
   - API Key
   - 模型名称
2. 设置每批处理的条目数量
3. 点击「开始翻译」，工具会自动批量调用 API 进行翻译
4. 支持暂停/继续翻译

### 3. 检查与编辑

翻译过程中或完成后，您可以：
- 查看所有原文和译文的对照
- 手动编辑任何翻译结果
- 未翻译的条目会以红色高亮显示

### 4. 导出翻译结果

点击「导出 XML」按钮，下载翻译完成的 XML 文件。导出的文件格式与源文件保持一致，仅替换 `<Dest>` 标签中的内容。

## 📁 项目结构

```
sims4-llm-translator/
├── src/
│   ├── components/     # React 组件
│   ├── hooks/          # 自定义 Hooks
│   ├── lib/            # 工具函数
│   ├── App.tsx         # 主应用组件
│   └── main.tsx        # 入口文件
├── examples/           # 示例 XML 文件
├── public/             # 静态资源
└── ...
```

## 🛠️ 技术栈

- **框架**: React 19
- **语言**: TypeScript 5.9
- **构建工具**: Vite 7
- **样式**: Tailwind CSS 4
- **UI 组件**: shadcn/ui + Radix UI
- **图标**: Lucide React

## 📝 示例文件

项目包含示例 XML 文件 `examples/jellypaw.xml`，可用于测试工具功能。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
