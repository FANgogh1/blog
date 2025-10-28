# Vue 3 博客系统

一个基于 Vue 3 + Vite + Supabase 构建的现代化博客系统，支持文章发布、点赞、评论等功能。

## 项目功能

### 核心功能
- 📝 **文章发布与管理**：支持富文本编辑器（Quill），实时预览
- 🎨 **精美UI设计**：科技风暗色主题，玻璃拟态效果
- ❤️ **点赞功能**：用户可为文章点赞，支持取消点赞
- 💬 **评论系统**：完整的评论功能，支持评论管理
- 📊 **通知中心**：点赞和评论通知
- 🔍 **搜索与筛选**：支持按日期筛选文章

### 文章正文样式
文章正文区域采用无边框设计，具有以下特性：
- **无边框设计**：正文内容不再显示边框，营造更沉浸的阅读体验
- **精美排版**：
  - 适中的行高（1.8）和字号（15px）
  - 优化段落间距
  - 标题样式突出
  - 代码块背景色和圆角
  - 引用块左侧边框装饰
  - 表格样式美化
- **响应式图片**：自动适配宽度，带圆角效果
- **链接悬停效果**：hover 时颜色变化
- **半透明背景**：使用玻璃拟态效果，与主题风格一致

## 技术栈

- **前端框架**：Vue 3 (Composition API)
- **构建工具**：Vite
- **后端服务**：Supabase (PostgreSQL + Auth + Storage)
- **富文本编辑器**：Quill (@vueup/vue-quill)
- **路由管理**：Vue Router
- **样式处理**：原生 CSS + CSS 变量

## 开发环境设置

### IDE 推荐

[VS Code](https://code.visualstudio.com/) + [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

### 浏览器设置

- Chromium 内核浏览器（Chrome, Edge, Brave 等）:
  - [Vue.js DevTools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd) 
  - [Chrome DevTools 自定义对象格式化器](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js DevTools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Firefox DevTools 自定义对象格式化器](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

### 配置文件

查看 [Vite 配置参考](https://vite.dev/config/)

## 安装和运行

### 安装依赖

```sh
npm install
```

### 开发模式（热更新）

```sh
npm run dev
```

### 生产构建

```sh
npm run build
```

## 使用说明

1. **创建文章**：点击右下角的"新增博客"按钮，填写标题和内容
2. **编辑文章**：在文章详情页，如果你是作者，可以点击"编辑"按钮修改文章
3. **点赞和评论**：在文章详情页，可以点赞文章或发表评论
4. **查看通知**：在导航栏点击"通知"查看点赞和评论通知
5. **筛选文章**：在首页左侧可以使用日期筛选器按日期查看文章

## 项目结构

```
src/
├── assets/          # 样式文件
├── components/      # 通用组件
├── lib/            # Supabase 配置
├── pages/          # 页面组件
│   ├── Home.vue    # 首页（文章列表）
│   ├── PostDetail.vue  # 文章详情页
│   ├── Login.vue   # 登录页
│   └── ...
└── router/         # 路由配置
```

## 最新更新

### 编辑器优化（最新）
- ✅ 移除新增和编辑文章时的预览功能，简化界面
- ✅ 增强编辑器宽度限制，防止边框拉伸
- ✅ 添加强制换行规则，连续字符会自动换行

### 白天模式主题适配修复
- ✅ 修复了白天模式下正文区域背景色未同步的问题
- ✅ 正文背景在白天模式下使用白色半透明背景
- ✅ 代码块和行内代码在白天模式下使用浅色背景
- ✅ 引用块文字颜色在白天模式下更加清晰
- ✅ 预览区域也正确适配白天模式

### 正文样式优化
- ✅ 移除了文章正文区域的边框，提供更沉浸的阅读体验
- ✅ 优化了正文内容的排版，包括标题、段落、列表、代码块等
- ✅ 添加了图片圆角效果和响应式适配
- ✅ 美化了链接、引用块、表格等元素的样式
- ✅ 统一了首页预览和详情页的正文样式
- ✅ 完美支持暗色和白天两种主题模式
