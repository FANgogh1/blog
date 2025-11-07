<script setup>
import { ref, onMounted, computed } from 'vue';
import { QuillEditor } from '@vueup/vue-quill';
import '@vueup/vue-quill/dist/vue-quill.snow.css';
import Quill from 'quill';
import MarkdownIt from 'markdown-it';
const md = new MarkdownIt();
import { supabase } from '../lib/supabase';

// 获取用户信息（优先从user_profiles表，其次从posts表，最后默认值）
const getUserInfoFromProfiles = async (userId) => {
  try {
    // 1. 首先尝试从user_profiles表获取
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('nickname, avatar_url')
      .eq('user_id', userId)
      .single();
    
    if (!profileError && profileData) {
      return { 
        nickname: profileData.nickname || '用户', 
        avatar_url: profileData.avatar_url || '' 
      };
    }
    
    // 2. 如果user_profiles表没有数据，尝试从posts表获取
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select('author_name, author_avatar')
      .eq('author', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!postsError && postsData && postsData.length > 0) {
      return { 
        nickname: postsData[0].author_name || '用户', 
        avatar_url: postsData[0].author_avatar || '' 
      };
    }
    
    // 3. 如果都没有数据，返回默认值
    return { nickname: '用户', avatar_url: '' };
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return { nickname: '用户', avatar_url: '' };
  }
};

// Dify Chatflow 配置和初始化
const initDifyChatbot = () => {
  // 设置全局配置
  window.difyChatbotConfig = {
    token: 'VKyUIYdfnWlDpLJB',
    baseUrl: 'https://dify.aipfuture.com',
    inputs: {
      // 可以在这里定义从开始节点的输入
      // key 是变量名
      // 例如：
      // name: "NAME"
    },
    systemVariables: {
      // user_id: '你可以在这里定义用户ID',
      // conversation_id: '你可以在这里定义会话ID，必须是有效的UUID',
    },
    userVariables: {
      // avatar_url: '你可以在这里定义用户头像URL',
      // name: '你可以在这里定义用户名',
    },
  };

  // 动态加载Dify脚本
  const script = document.createElement('script');
  script.src = 'https://dify.aipfuture.com/embed.min.js';
  script.id = 'VKyUIYdfnWlDpLJB';
  script.defer = true;
  document.head.appendChild(script);

  // 添加自定义样式
  const style = document.createElement('style');
  style.textContent = `
    #dify-chatbot-bubble-button {
      background-color: #1C64F2 !important;
    }
    #dify-chatbot-bubble-window {
      width: 24rem !important;
      height: 40rem !important;
      position: fixed !important;
      right: 20px !important;
      bottom: 20px !important;
      z-index: 1000 !important;
    }
    #dify-chatbot-bubble-window iframe {
      position: fixed !important;
      right: 20px !important;
      bottom: 20px !important;
      z-index: 1000 !important;
    }
  `;
  document.head.appendChild(style);
};

const stripHtml = (html) => {
  if (!html) return '';
  return String(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
};

const loading = ref(true);
const posts = ref([]);

const sample = [
  { id: 'sample-1', title: '用 Vue 3 构建扁平化博客 UI', content: '快速搭建简洁美观的前端页面与路由...' },
  { id: 'sample-2', title: '前端性能优化 10 条实用建议', content: '从资源、交互与渲染三个维度入手...' },
  { id: 'sample-3', title: 'CSS 扁平化设计指南', content: '一致的阴影、圆角与色彩层级...' },
];

const fetchPosts = async () => {
  loading.value = true;
  const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
  
  if (error) {
    posts.value = [];
  } else {
    // 对每个文章作者同步获取最新的用户信息
    const postsWithLatestInfo = await Promise.all(
      (data || []).map(async (post) => {
        if (post.author) {
          try {
            const userInfo = await getUserInfoFromProfiles(post.author);
            return {
              ...post,
              author_name: userInfo.nickname,
              author_avatar: userInfo.avatar_url
            };
          } catch (error) {
            console.error('获取用户信息失败:', error);
            return post;
          }
        }
        return post;
      })
    );
    posts.value = postsWithLatestInfo;
  }
  
  if (!posts.value?.length) posts.value = sample;
  loading.value = false;
};

const selectedDate = ref('');
const toYYYYMMDD = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
};
const filteredPosts = computed(() => {
  if (!selectedDate.value) return posts.value;
  return (posts.value || []).filter(p => {
    if (!p.created_at) return false;
    try {
      return toYYYYMMDD(new Date(p.created_at)) === selectedDate.value;
    } catch { return false; }
  });
});

// 首页轮播图（从 Supabase Storage:banners/home 读取）
const banners = ref([]);
const curBanner = ref(0);
let bannerTimer = null;
const nextBanner = () => { if (banners.value.length) curBanner.value = (curBanner.value + 1) % banners.value.length; };
const prevBanner = () => { if (banners.value.length) curBanner.value = (curBanner.value - 1 + banners.value.length) % banners.value.length; };
const fetchBanners = async () => {
  try {
    const { data, error } = await supabase.storage.from('banners').list('home', { limit: 50, sortBy: { column: 'name', order: 'asc' } });
    if (error) return;
    const urls = (data || [])
      .filter(f => f && f.name && !String(f.name).startsWith('.'))
      .map(f => {
        const path = String(f.name).includes('/') ? f.name : `home/${f.name}`;
        return supabase.storage.from('banners').getPublicUrl(path).data?.publicUrl;
      })
      .filter(Boolean);
    banners.value = urls;
    if (bannerTimer) { clearInterval(bannerTimer); bannerTimer = null; }
    if (banners.value.length > 1) bannerTimer = setInterval(nextBanner, 5000);
  } catch {}
};

// 在组件挂载时初始化所有功能
onMounted(() => {
  fetchPosts();
  fetchBanners();
  initDifyChatbot();
});

/* 创建文章表单 */
const showCreate = ref(false);
const form = ref({ title: '', content: '' });
const saving = ref(false);
const errorMsg = ref('');
const uploadingImage = ref(false);
const imageUploadError = ref('');
const quillEditorRef = ref(null);

// 处理粘贴事件
const handlePaste = async (event) => {
  const clipboardData = event.clipboardData || event.clipboardData;
  const items = clipboardData?.items;

  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // 检查是否是图片
    if (item.type.indexOf('image') !== -1) {
      event.preventDefault();
      
      const blob = item.getAsFile();
      if (!blob) continue;

      // 上传图片
      await uploadImageFromBlob(blob);
      break;
    }
  }
};

// 从 Blob 上传图片
const uploadImageFromBlob = async (blob) => {
  imageUploadError.value = '';
  imageUploading.value = true;

  try {
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id || userRes?.data?.user?.id;
    if (!userId) {
      imageUploadError.value = '请先登录';
      imageUploading.value = false;
      return;
    }

    const fileName = `${userId}_${Date.now()}_paste.png`;
    const filePath = `post-images/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('post-images')
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      imageUploadError.value = '图片上传失败';
      console.error('Upload error:', uploadError);
      imageUploading.value = false;
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('post-images')
      .getPublicUrl(filePath);

    // 插入图片到编辑器
    if (quillEditorRef.value) {
      const editor = quillEditorRef.value.getQuill();
      const range = editor.getSelection();
      editor.insertEmbed(range?.index || 0, 'image', publicUrl);
    }

    imageUploadError.value = '';
  } catch (err) {
    imageUploadError.value = '上传失败，请重试';
    console.error('Upload error:', err);
  } finally {
    imageUploading.value = false;
  }
};

const imageUploading = ref(false);

const createPost = async () => {
  errorMsg.value = '';
  if (!form.value.title.trim() || !form.value.content.trim()) {
    errorMsg.value = '标题与内容不能为空';
    return;
  }
  saving.value = true;

  // 必须登录：RLS 要求 author 等于当前用户
  const { data: userRes } = await supabase.auth.getUser();
  const author = userRes?.user?.id || userRes?.data?.user?.id || null;
  if (!author) {
    saving.value = false;
    errorMsg.value = '请先登录后再创建文章';
    return;
  }

  const meta = userRes?.user?.user_metadata || userRes?.data?.user?.user_metadata || {};
  const author_name = meta.nickname?.trim() || userRes?.user?.email || userRes?.data?.user?.email || '匿名';
  const author_avatar = meta.avatar_url || '';

  const { error } = await supabase
    .from('posts')
    .insert([{ title: form.value.title.trim(), content: form.value.content, author, author_name, author_avatar }]);

  saving.value = false;
  if (error) {
    errorMsg.value = error.message || '创建失败';
    return;
  }
  showCreate.value = false;
  form.value = { title: '', content: '' };
  await fetchPosts();
};

// 上传图片到 Supabase Storage
const uploadImage = async (event) => {
  imageUploadError.value = '';
  const file = event.target.files?.[0];
  if (!file) return;

  // 检查文件类型
  if (!file.type.startsWith('image/')) {
    imageUploadError.value = '请选择图片文件';
    return;
  }

  // 检查文件大小（限制为 5MB）
  if (file.size > 5 * 1024 * 1024) {
    imageUploadError.value = '图片大小不能超过 5MB';
    return;
  }

  uploadingImage.value = true;

  try {
    // 获取当前用户信息
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id || userRes?.data?.user?.id;
    if (!userId) {
      imageUploadError.value = '请先登录';
      uploadingImage.value = false;
      return;
    }

    // 生成唯一文件名
    const fileName = `${userId}_${Date.now()}_${file.name}`;
    const filePath = `post-images/${fileName}`;

    // 上传到 Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('post-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true // 改为 true，允许覆盖同名文件
      });

    if (uploadError) {
      imageUploadError.value = uploadError.message || '上传失败：' + (uploadError.error || JSON.stringify(uploadError));
      uploadingImage.value = false;
      console.error('Upload error details:', uploadError);
      return;
    }

    // 获取图片的公开 URL
    const { data: { publicUrl } } = supabase.storage
      .from('post-images')
      .getPublicUrl(filePath);

    // 插入图片到编辑器
    const imgTag = `<img src="${publicUrl}" alt="上传的图片" style="max-width: 100%;" />`;
    form.value.content = (form.value.content || '') + imgTag;

    imageUploadError.value = '';
  } catch (err) {
    imageUploadError.value = '上传失败，请重试';
    console.error('Upload error:', err);
  } finally {
    uploadingImage.value = false;
    // 清空 input 值，以便再次选择同一文件
    event.target.value = '';
  }
};
</script>

<template>
  <!-- 整体网格布局：左侧筛选栏 + 右侧内容区 -->
  <div class="main-grid">
    <!-- 左侧筛选栏 -->
    <aside class="sidebar">
      <div class="card filter-card">
        <div class="filter-header">按日期筛选</div>
        <input class="input" type="date" v-model="selectedDate" />
        <div class="filter-info">
          已选：{{ selectedDate || '未选择（显示全部）' }}
        </div>
        <div class="filter-actions">
          <button class="btn" @click="selectedDate = ''">清除筛选</button>
          <button class="btn" @click="selectedDate = toYYYYMMDD(new Date())">今天</button>
        </div>
      </div>
    </aside>

    <!-- 右侧内容区 -->
    <main class="content-area">
      <!-- 轮播图 -->
      <div v-if="banners.length" class="banner-section">
        <div class="card banner-card">
          <img :src="banners[curBanner]" alt="banner" class="banner-image" />
          <button class="btn banner-nav prev" @click="prevBanner">‹</button>
          <button class="btn banner-nav next" @click="nextBanner">›</button>
          <div class="banner-dots">
            <span v-for="(b, i) in banners" :key="i" :class="{ active: i===curBanner }"></span>
          </div>
        </div>
      </div>

      <!-- 文章列表 -->
      <div class="posts-section">
        <div class="posts-grid">
          <router-link v-for="p in filteredPosts" :key="p.id" class="card post-card" :to="{ name: 'post', params: { id: p.id } }">
            <h3 class="post-title">{{ p.title }}</h3>
            <div class="post-meta">
              <div class="author-info">
                <router-link v-if="p.author" :to="{ name: 'user', params: { id: p.author } }" style="text-decoration:none; color:inherit;">
                  <div style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <img v-if="p.author_avatar" :src="p.author_avatar" alt="avatar" class="author-avatar" />
                    <div v-else class="author-avatar-placeholder">
                      {{ (p.author_name || '匿名').slice(0,1).toUpperCase() }}
                    </div>
                    <span class="author-name">{{ p.author_name || '匿名' }}</span>
                  </div>
                </router-link>
                <div v-else style="display:flex; align-items:center; gap:8px;">
                  <img v-if="p.author_avatar" :src="p.author_avatar" alt="avatar" class="author-avatar" />
                  <div v-else class="author-avatar-placeholder">
                    {{ (p.author_name || '匿名').slice(0,1).toUpperCase() }}
                  </div>
                  <span class="author-name">{{ p.author_name || '匿名' }}</span>
                </div>
              </div>
              <span class="post-date">{{ p.created_at ? new Date(p.created_at).toLocaleString() : '' }}</span>
            </div>
            <p class="post-excerpt">{{ stripHtml(p.content)?.slice(0, 60) || '' }}</p>
            <div class="post-actions">
              <span class="btn view-btn">查看详情</span>
            </div>
          </router-link>
        </div>
      </div>
    </main>
  </div>

  <!-- 悬浮新增按钮 -->
  <button class="new-post-btn" style="position:fixed; left:60px; top: 100px; z-index:30;" @click="showCreate = true">
    <span class="btn-icon">✏️</span>
    <span class="btn-text">新建文章</span>
  </button>

  <!-- 创建弹窗 -->
  <div v-if="showCreate" style="position:fixed; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; z-index:40;">
    <div class="card" style="width:900px; max-width:95vw; max-height:95vh; padding:20px; display:grid; gap:16px; overflow:hidden;">
      <h3 style="margin:0; font-size:24px;">新建文章</h3>
      <label style="font-size:16px;">
        标题
        <input class="input" v-model="form.title" placeholder="请输入标题" style="font-size:16px; padding:12px;" />
      </label>
      <div>
        <div style="font-weight:600; margin-bottom:8px; font-size:16px;">内容</div>
        <div class="card editor-wrapper" style="padding:0; overflow:visible;">
          <QuillEditor 
            theme="snow" 
            v-model:content="form.content" 
            contentType="html" 
            style="height:50vh; min-height:400px;"
            @paste="handlePaste"
            ref="quillEditorRef"
          />
        </div>
        <div style="margin-top:8px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <label class="btn" style="cursor:pointer; margin:0;">
            <input type="file" accept="image/*" @change="uploadImage" style="display:none;" :disabled="uploadingImage" />
            {{ uploadingImage ? '上传中...' : '插入图片' }}
          </label>
          <span v-if="imageUploadError" style="color:#ff6b6b; font-size:12px;">{{ imageUploadError }}</span>
        </div>
      </div>

      <!-- 按钮区域 - 右上角 -->
      <div style="position:absolute; top:20px; right:20px; display:flex; gap:8px; align-items:center;">
        <button class="btn" @click="showCreate = false">取消</button>
        <button class="btn primary" :disabled="saving" @click="createPost">{{ saving ? '创建中...' : '创建' }}</button>
      </div>
      
      <!-- 错误信息和提示信息 -->
      <div v-if="errorMsg" style="color:#ff6b6b; margin-top:8px;">{{ errorMsg }}</div>
      <div style="color:var(--muted); font-size:12px; margin-top:8px;">提示：需登录后创建文章</div>
    </div>
  </div>
  <!-- Dify Chatflow 聊天机器人 -->
  <div id="dify-chatbot-container" style="position: fixed; right: 20px; bottom: 20px; z-index: 1000;"></div>
</template>

<style scoped>
/* 主网格布局 */
.main-grid {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 24px;
  align-items: start;
}

/* 左侧筛选栏 */
.sidebar {
  position: sticky;
  top: 200px;
  height: fit-content;
}

.filter-card {
  padding: 16px;
  background: var(--card-bg);
  border-radius: 12px;
  border: 1px solid var(--border);
}

.filter-header {
  font-weight: 600;
  font-size: 16px;
  margin-bottom: 12px;
  color: var(--text);
}

.filter-info {
  color: var(--muted);
  font-size: 12px;
  margin-top: 8px;
  line-height: 1.4;
}

.filter-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.filter-actions .btn {
  flex: 1;
  font-size: 12px;
  padding: 6px 8px;
}

/* 右侧内容区 */
.content-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 轮播图区域 */
.banner-section {
  width: 100%;
}

.banner-card {
  position: relative;
  padding: 0;
  overflow: hidden;
  border-radius: 12px;
  height: 300px;
  background: var(--card-bg);
  border: 1px solid var(--border);
}

.banner-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.banner-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.banner-nav:hover {
  background: rgba(0, 0, 0, 0.7);
}

.banner-nav.prev {
  left: 16px;
}

.banner-nav.next {
  right: 16px;
}

.banner-dots {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 16px;
  display: flex;
  justify-content: center;
  gap: 8px;
}

.banner-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border);
  transition: background-color 0.2s ease;
}

.banner-dots span.active {
  background: var(--primary);
}

/* 文章列表区域 */
.posts-section {
  width: 100%;
}

.posts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.post-card {
  padding: 20px;
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.post-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.post-title {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text);
}

.post-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 14px;
}

.author-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--border);
}

.author-avatar-placeholder {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #163229;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--primary);
  font-weight: 700;
}

.post-date {
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}

.post-excerpt {
  color: var(--muted);
  margin: 0;
  line-height: 1.5;
  flex: 1;
  font-size: 14px;
}

.post-actions {
  margin-top: auto;
  display: flex;
  gap: 8px;
  padding-top: 16px;
}

.view-btn {
  pointer-events: none;
  font-size: 14px;
  padding: 8px 16px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .main-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .sidebar {
    position: static;
  }
  
  .posts-grid {
    grid-template-columns: 1fr;
  }
  
  .banner-card {
    height: 200px;
  }
  
  .banner-nav {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }
}

/* 编辑器样式 - 固定宽度并自动换行 */
.editor-wrapper {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.editor-wrapper :deep(.ql-container) {
  font-size: 14px;
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-all;
  max-width: 100%;
  overflow-x: hidden;
}

.editor-wrapper :deep(.ql-editor) {
  max-width: 100%;
  overflow-wrap: break-word;
  word-wrap: break-word;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: hidden;
}

.editor-wrapper :deep(.ql-editor p),
.editor-wrapper :deep(.ql-editor h1),
.editor-wrapper :deep(.ql-editor h2),
.editor-wrapper :deep(.ql-editor h3),
.editor-wrapper :deep(.ql-editor h4),
.editor-wrapper :deep(.ql-editor h5),
.editor-wrapper :deep(.ql-editor h6),
.editor-wrapper :deep(.ql-editor li),
.editor-wrapper :deep(.ql-editor div),
.editor-wrapper :deep(.ql-editor span) {
  max-width: 100%;
  overflow-wrap: break-word;
  word-wrap: break-word;
  white-space: pre-wrap;
  word-break: break-word;
  display: block;
  box-sizing: border-box;
}

/* 防止单行文本溢出 */
.editor-wrapper :deep(.ql-editor) * {
  max-width: 100% !important;
  word-break: break-all !important;
  overflow-wrap: anywhere !important;
  hyphens: auto;
}

/* 编辑器工具栏 */
.editor-wrapper :deep(.ql-toolbar) {
  max-width: 100%;
  overflow-x: visible;
  position: sticky;
  top: 0;
  z-index: 2;
}

/* 文章正文样式美化 */
.post-content {
  padding: 20px;
  background: rgba(18, 22, 30, 0.3);
  border-radius: 12px;
  line-height: 1.8;
  color: var(--text);
  font-size: 15px;
  max-height: 280px;
  overflow: auto;
}

/* 白天模式背景色 */
:root[data-theme='light'] .post-content {
  background: rgba(255, 255, 255, 0.6);
}

/* 确保预览中图片等内容适配宽度 */
.post-content :deep(img) { 
  max-width: 100%; 
  height: auto; 
  border-radius: 8px;
  margin: 16px 0;
}

/* 正文中链接样式 */
.post-content :deep(a) {
  color: var(--primary);
  text-decoration: underline;
  transition: color 0.2s ease;
}

.post-content :deep(a:hover) {
  color: var(--primary-hover);
}

/* 标题样式 */
.post-content :deep(h1),
.post-content :deep(h2),
.post-content :deep(h3),
.post-content :deep(h4),
.post-content :deep(h5),
.post-content :deep(h6) {
  margin: 24px 0 12px;
  color: var(--text);
  font-weight: 700;
}

.post-content :deep(p) {
  margin: 12px 0;
}

/* 代码块样式 */
.post-content :deep(code) {
  background: rgba(0, 232, 132, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.9em;
}

/* 白天模式行内代码背景 */
:root[data-theme='light'] .post-content :deep(code) {
  background: rgba(14, 165, 233, 0.1);
}

.post-content :deep(pre) {
  background: rgba(0, 0, 0, 0.3);
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 16px 0;
}

.post-content :deep(pre code) {
  background: transparent;
  padding: 0;
}

/* 白天模式代码块背景 */
:root[data-theme='light'] .post-content :deep(pre) {
  background: rgba(0, 0, 0, 0.05);
}

/* 引用块样式 */
.post-content :deep(blockquote) {
  border-left: 3px solid var(--primary);
  padding-left: 16px;
  margin: 16px 0;
  color: var(--muted);
  font-style: italic;
}

/* 白天模式引用块颜色 */
:root[data-theme='light'] .post-content :deep(blockquote) {
  color: #4a5568;
}

/* 列表样式 */
.post-content :deep(ul),
.post-content :deep(ol) {
  margin: 12px 0;
  padding-left: 24px;
}

.post-content :deep(li) {
  margin: 6px 0;
}

/* 表格样式 */
.post-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
}

.post-content :deep(th),
.post-content :deep(td) {
  border: 1px solid var(--border);
  padding: 8px 12px;
  text-align: left;
}

.post-content :deep(th) {
  background: rgba(0, 232, 132, 0.1);
  font-weight: 600;
}

/* 水平分隔线 */
.post-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 24px 0;
}

/* 美化新建文章按钮 */
.new-post-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  background: linear-gradient(135deg, var(--primary), #00d9ff);
  color: white;
  border: none;
  border-radius: 50px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(0, 217, 255, 0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: auto;
  white-space: nowrap;
}

.new-post-btn:hover {
  transform: translateY(-3px) scale(1.05);
  box-shadow: 0 12px 30px rgba(0, 217, 255, 0.6);
  background: linear-gradient(135deg, #00d9ff, var(--primary));
}

.new-post-btn:active {
  transform: translateY(-1px) scale(1.02);
  transition: all 0.1s ease;
}

.btn-icon {
  font-size: 22px;
  line-height: 1;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.btn-text {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* 响应式按钮调整 */
@media (max-width: 768px) {
  .new-post-btn {
    padding: 14px 20px;
    font-size: 16px;
    gap: 10px;
  }
  
  .btn-icon {
    font-size: 20px;
  }
  
  .btn-text {
    font-size: 16px;
  }
}

@media (max-width: 480px) {
  .new-post-btn {
    padding: 12px 18px;
    font-size: 15px;
    gap: 8px;
  }
  
  .btn-icon {
    font-size: 18px;
  }
  
  .btn-text {
    font-size: 15px;
  }
}
</style>