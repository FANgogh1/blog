<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { supabase } from '../lib/supabase';
import { QuillEditor } from '@vueup/vue-quill';
import '@vueup/vue-quill/dist/vue-quill.snow.css';
import Quill from 'quill';
import { useAISummary } from '../lib/dify';

const route = useRoute();
const id = computed(() => String(route.params.id));

const title = ref('加载中...');
const content = ref('');
const authorName = ref('');
const authorAvatar = ref('');
const publishTime = ref('');
const ownPost = ref(false);
const editMode = ref(false);
const editForm = ref({ title: '', content: '' });
const editSaving = ref(false);
const editError = ref('');
const deleteLoading = ref(false);
const uploadingImage = ref(false);
const imageUploadError = ref('');
const quillEditorRef = ref(null);

// AI总结功能
const { isSummarizing, summaryResult, summaryError, summarize, clearSummary } = useAISummary();
const showSummary = ref(false);

// 执行AI总结
const handleAISummary = async () => {
  try {
    await summarize(content.value, title.value);
    showSummary.value = true;
  } catch (error) {
    console.error('AI总结失败:', error);
  }
};

// 关闭总结面板
const closeSummary = () => {
  showSummary.value = false;
  clearSummary();
};

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

/* 点赞：使用 Supabase 后端 */
const likeCount = ref(0);
const liked = ref(false);
const likeError = ref('');
const likeLoading = ref(false);

const fetchLikeInfo = async (postId, userId) => {
  const { count: totalCount } = await supabase
    .from('post_likes')
    .select('user_id', { count: 'exact', head: true })
    .eq('post_id', postId);
  likeCount.value = totalCount || 0;

  if (userId) {
    const { count: myCount } = await supabase
      .from('post_likes')
      .select('user_id', { count: 'exact', head: true })
      .eq('post_id', postId)
      .eq('user_id', userId);
    liked.value = (myCount || 0) > 0;
  } else {
    liked.value = false;
  }
};

const like = async () => {
  likeError.value = '';
  likeLoading.value = true;
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id || userRes?.data?.user?.id;
  if (!userId) {
    likeLoading.value = false;
    likeError.value = '请先登录后再点赞';
    return;
  }
  if (liked.value) {
    // 取消点赞：删除自己的点赞记录
    const { error } = await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', id.value)
      .eq('user_id', userId);
    likeLoading.value = false;
    if (error) {
      likeError.value = error.message || '取消点赞失败';
      return;
    }
    liked.value = false;
    likeCount.value = Math.max(0, (likeCount.value || 0) - 1);
    return;
  }
  // 点赞：插入记录
  const { data: userRes2 } = await supabase.auth.getUser();
  const me = userRes2?.user || userRes2?.data?.user;
  const meta2 = me?.user_metadata || {};
  const actor_name2 = (meta2.nickname && meta2.nickname.trim())
    || (meta2.full_name && meta2.full_name.trim())
    || (meta2.name && meta2.name.trim())
    || me?.email;
  const actor_avatar2 = meta2.avatar_url || meta2.picture || '';
  const { error } = await supabase
    .from('post_likes')
    .insert([{ post_id: id.value, user_id: userId }]);
  likeLoading.value = false;
  if (error) {
    likeError.value = error.message || '点赞失败';
    return;
  }
  liked.value = true;
  likeCount.value += 1;
  // 通知文章作者（点赞）
  try {
    const { data: postRes } = await supabase.from('posts').select('author,title').eq('id', id.value).single();
    const recipient = postRes?.author || null;
    const post_title = postRes?.title || '';
    if (recipient && recipient !== userId) {
      await supabase.from('notifications').insert([{ recipient, actor: userId, post_id: id.value, type: 'like', actor_name: actor_name2, actor_avatar: actor_avatar2, post_title }]);
    }
  } catch (_) {}
}

/* 评论：使用 Supabase 后端 */
const comments = ref([]);
const newComment = ref('');
const commentLoading = ref(false);
const commentError = ref('');

const fetchComments = async (postId) => {
  const { data, error } = await supabase
    .from('post_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: false });
  if (error) {
    comments.value = [];
    return;
  }
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id || userRes?.data?.user?.id || null;
  comments.value = (data || []).map(c => ({ ...c, _isMine: uid && c.user_id === uid }));
};

const addComment = async () => {
  commentError.value = '';
  const content = newComment.value?.trim();
  if (!content) return;

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user || userRes?.data?.user;
  if (!user) {
    commentError.value = '请先登录后再发表评论';
    return;
  }
  const meta = user.user_metadata || {};
  const author_name = (meta.nickname && meta.nickname.trim())
    || (meta.full_name && meta.full_name.trim())
    || (meta.name && meta.name.trim())
    || user.email
    || '匿名';
  const author_avatar = meta.avatar_url || meta.picture || '';

  commentLoading.value = true;
  const { error } = await supabase
    .from('post_comments')
    .insert([{ post_id: id.value, user_id: user.id, content, author_name, author_avatar }]);
  commentLoading.value = false;
  if (error) {
    commentError.value = error.message || '发表评论失败';
    return;
  }
  // 通知文章作者（包含评论内容摘要）
  try {
    const { data: postRes } = await supabase.from('posts').select('author,title').eq('id', id.value).single();
    const recipient = postRes?.author || null;
    const post_title = postRes?.title || '';
    if (recipient && recipient !== user.id) {
      const { error: nErr } = await supabase.from('notifications').insert([{ recipient, actor: user.id, post_id: id.value, type: 'comment', content: content.slice(0, 140), actor_name: author_name, actor_avatar: author_avatar, post_title }]);
      if (nErr) {
        console.error('notify insert failed', nErr);
      } else {
        window.dispatchEvent(new CustomEvent('refresh-unread'));
      }
    }
  } catch (e) {
    console.error('notify error', e);
  }
  newComment.value = '';
  await fetchComments(id.value);
};

const startEdit = () => { editMode.value = true; editError.value=''; };
const cancelEdit = () => { editMode.value = false; editError.value=''; editForm.value = { title: title.value, content: content.value }; };
const saveEdit = async () => {
  editError.value = '';
  if (!editForm.value.title.trim() || !editForm.value.content.trim()) {
    editError.value = '标题和内容不能为空';
    return;
  }
  editSaving.value = true;
  const { error } = await supabase
    .from('posts')
    .update({ title: editForm.value.title.trim(), content: editForm.value.content.trim() })
    .eq('id', id.value);
  editSaving.value = false;
  if (error) { editError.value = error.message || '保存失败'; return; }
  title.value = editForm.value.title.trim();
  content.value = editForm.value.content.trim();
  editMode.value = false;
};

const deletePost = async () => {
  if (deleteLoading.value) return;
  deleteLoading.value = true;
  const { error } = await supabase.from('posts').delete().eq('id', id.value);
  deleteLoading.value = false;
  if (error) { editError.value = error.message || '删除失败'; return; }
  window.location.href = '/';
};

const onDeleteComment = async (c) => {
  if (!c || !c.id) return;
  const { error } = await supabase
    .from('post_comments')
    .delete()
    .eq('id', c.id);
  if (error) {
    commentError.value = error.message || '删除失败';
    return;
  }
  await fetchComments(id.value);
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
    editForm.value.content = (editForm.value.content || '') + imgTag;

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

onMounted(async () => {
  const { data, error } = await supabase.from('posts').select('*').eq('id', id.value).single();
  if (!error && data) {
    title.value = data.title;
    content.value = data.content;
    authorName.value = data.author_name || '匿名';
    authorAvatar.value = data.author_avatar || '';
    publishTime.value = data.created_at ? new Date(data.created_at).toLocaleString() : '';
    editForm.value = { title: data.title, content: data.content };
    // 判断是否本人文章
    const { data: userRes0 } = await supabase.auth.getUser();
    const uid0 = userRes0?.user?.id || userRes0?.data?.user?.id || null;
    ownPost.value = !!uid0 && data.author === uid0;
  } else {
    const map = {
      '1': '用 Vue 3 构建扁平化博客 UI',
      '2': '前端性能优化 10 条实用建议',
      '3': 'CSS 扁平化设计指南',
    };
    title.value = map[id.value] || '示例文章';
    content.value = '这是示例文章内容，仅用于演示页面结构。你可以替换为后端返回的 Markdown/HTML。末尾提供点赞与评论功能（本地存储）。';
  }

  // 点赞信息
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id || userRes?.data?.user?.id || null;
  await fetchLikeInfo(id.value, userId);

  // 评论加载（后端）
  await fetchComments(id.value);
});
</script>

<template>
  <article class="card article-header">
    <div class="article-top">
      <div class="article-info">
        <h1 style="margin:0 0 8px;">{{ title }}</h1>
        <div style="display:flex; align-items:center; gap:10px; color:var(--muted);">
          <img v-if="authorAvatar" :src="authorAvatar" alt="avatar" style="width:28px; height:28px; border-radius:50%; object-fit:cover; border:1px solid var(--border);" />
          <div v-else style="width:28px; height:28px; border-radius:50%; background:#163229; display:flex; align-items:center; justify-content:center; font-size:12px; color:var(--primary); font-weight:700;">
            {{ (authorName || '匿名').slice(0,1).toUpperCase() }}
          </div>
          <span>{{ authorName || '匿名' }}</span>
          <span style="font-size:12px;">{{ publishTime ? `发布于 ${publishTime}` : '' }} · 文章 ID：{{ id }}</span>
        </div>
      </div>
      <router-link class="btn" to="/" style="flex-shrink:0;">返回首页</router-link>
    </div>
    <!-- 编辑操作：仅作者可见 -->
    <div v-if="ownPost" style="display:flex; gap:8px; margin-bottom:12px;">
      <button class="btn" @click="startEdit">编辑</button>
      <button class="btn" :disabled="deleteLoading" @click="deletePost">{{ deleteLoading ? '删除中...' : '删除' }}</button>
    </div>

    <!-- 内容/编辑表单 -->
    <div v-if="!editMode" style="margin-bottom:16px;">
      <div class="post-content" v-html="content"></div>
    </div>

    <div v-else class="card" style="padding:12px; display:grid; gap:10px; margin-bottom:16px; max-height:85vh; overflow:auto;">
      <label>
        标题
        <input class="input" v-model="editForm.title" />
      </label>

       <div>
         <div style="font-weight:600; margin-bottom:6px;">内容</div>
         <div class="card editor-wrapper" style="padding:0; overflow:visible;">
           <QuillEditor 
             theme="snow" 
             v-model:content="editForm.content" 
             contentType="html" 
             style="height:50vh; min-height:280px;"
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

      <div style="display:flex; gap:8px; align-items:center;">
        <button class="btn primary" :disabled="editSaving" @click="saveEdit">{{ editSaving ? '保存中...' : '保存' }}</button>
        <button class="btn" @click="cancelEdit">取消</button>
      </div>
      <div v-if="editError" style="color:#ff6b6b;">{{ editError }}</div>
    </div>

    <div style="display:flex; gap:12px; align-items:center; margin-bottom:16px;">
      <button class="btn primary" :disabled="likeLoading" @click="like">
        {{ likeLoading ? '处理中...' : (liked ? '取消点赞' : ' 点赞') }}
      </button>
      <span style="color:var(--muted);">获赞数：{{ likeCount }}</span>
      <span v-if="likeError" style="color:#ff6b6b;">{{ likeError }}</span>
    </div>

    <div class="card" style="padding:16px; border:1px dashed var(--border);">
      <h3 style="margin:0 0 12px;">评论</h3>
      <div style="display:flex; gap:8px; margin-bottom:12px;">
        <input class="input" v-model="newComment" placeholder="写下你的看法..." />
        <button class="btn" :disabled="commentLoading" @click="addComment">{{ commentLoading ? '发表中...' : '发表' }}</button>
      </div>
      <div v-if="commentError" style="color:#ff6b6b;">{{ commentError }}</div>
      <div v-if="comments.length === 0" style="color:var(--muted);">暂无评论</div>
      <ul v-else style="list-style:none; padding:0; margin:0; display:grid; gap:10px;">
        <li v-for="c in comments" :key="c.id" class="card" style="padding:12px; display:grid; gap:6px;">
          <div style="display:flex; align-items:center; gap:8px; color:var(--muted);">
            <img v-if="c.author_avatar" :src="c.author_avatar" alt="avatar" style="width:22px; height:22px; border-radius:50%; object-fit:cover; border:1px solid var(--border);" />
            <div v-else style="width:22px; height:22px; border-radius:50%; background:#163229; display:flex; align-items:center; justify-content:center; font-size:11px; color:var(--primary); font-weight:700;">
              {{ (c.author_name || '匿名').slice(0,1).toUpperCase() }}
            </div>
            <span>{{ c.author_name || '匿名' }}</span>
            <span style="margin-left:auto; font-size:12px;">{{ c.created_at ? new Date(c.created_at).toLocaleString() : '' }}</span>
          </div>
          <div style="display:flex; align-items:flex-start; gap:8px;">
            <div style="flex:1;">{{ c.content }}</div>
            <button v-if="c._isMine" class="btn" style="padding:6px 10px;" @click="onDeleteComment(c)">删除</button>
          </div>
        </li>
      </ul>
    </div>
  </article>

  <!-- AI总结按钮 - 固定在文章右侧 -->
  <div class="ai-summary-container">
    <button 
      class="ai-summary-btn" 
      @click="handleAISummary" 
      :disabled="isSummarizing"
      :class="{ 'loading': isSummarizing }"
    >
      <span v-if="isSummarizing">🤖 总结中...</span>
      <span v-else>🤖 AI总结</span>
    </button>

    <!-- AI总结结果面板 -->
    <div v-if="showSummary" class="ai-summary-panel">
      <div class="ai-summary-header">
        <h3>🤖 AI文章总结</h3>
        <button class="ai-summary-close" @click="closeSummary">×</button>
      </div>
      <div class="ai-summary-content">
        <div v-if="summaryError" class="ai-summary-error">
          {{ summaryError }}
        </div>
        <div v-else-if="summaryResult" class="ai-summary-text">
          {{ summaryResult }}
        </div>
        <div v-else class="ai-summary-loading">
          正在生成总结...
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
}

/* 文章头部布局 */
.article-header {
  padding: 20px;
}

.article-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.article-info {
  flex: 1;
  min-width: 0;
}

/* 响应式布局 - 移动端时按钮换行 */
@media (max-width: 640px) {
  .article-top {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .article-top .btn {
    width: 100%;
  }
}

/* 文章正文样式美化 */
.post-content {
  padding: 20px;
  background: rgba(18, 22, 30, 0.3);
  border-radius: 12px;
  line-height: 1.8;
  color: var(--text);
  font-size: 15px;
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

/* 白天模式代码块和行内代码背景 */
:root[data-theme='light'] .post-content :deep(pre) {
  background: rgba(0, 0, 0, 0.05);
}

:root[data-theme='light'] .post-content :deep(code) {
  background: rgba(14, 165, 233, 0.1);
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

/* 编辑模式预览样式（带滚动限制） */
.post-content-preview {
  padding: 20px;
  background: rgba(18, 22, 30, 0.3);
  border-radius: 12px;
  line-height: 1.8;
  color: var(--text);
  font-size: 15px;
  max-height: 280px;
  overflow: auto;
}

/* 白天模式预览背景色 */
:root[data-theme='light'] .post-content-preview {
  background: rgba(255, 255, 255, 0.6);
}

.post-content-preview :deep(img) { 
  max-width: 100%; 
  height: auto; 
  border-radius: 8px;
  margin: 16px 0;
}

.post-content-preview :deep(a) {
  color: var(--primary);
  text-decoration: underline;
}

.post-content-preview :deep(h1),
.post-content-preview :deep(h2),
.post-content-preview :deep(h3),
.post-content-preview :deep(h4),
.post-content-preview :deep(h5),
.post-content-preview :deep(h6) {
  margin: 24px 0 12px;
  color: var(--text);
  font-weight: 700;
}

.post-content-preview :deep(p) {
  margin: 12px 0;
}

.post-content-preview :deep(code) {
  background: rgba(0, 232, 132, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.post-content-preview :deep(pre) {
  background: rgba(0, 0, 0, 0.3);
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 16px 0;
}

/* 白天模式预览代码块背景 */
:root[data-theme='light'] .post-content-preview :deep(pre) {
  background: rgba(0, 0, 0, 0.05);
}

:root[data-theme='light'] .post-content-preview :deep(code) {
  background: rgba(14, 165, 233, 0.1);
}

/* AI总结功能样式 */
.ai-summary-container {
  position: fixed;
  top: 100px;
  right: 20px;
  z-index: 1000;
}

.ai-summary-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 50px;
  padding: 16px 28px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 10px;
}

.ai-summary-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
}

.ai-summary-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.ai-summary-btn.loading {
  background: linear-gradient(135deg, #a8a8a8 0%, #7a7a7a 100%);
}

.ai-summary-panel {
  position: absolute;
  top: 60px;
  right: 0;
  width: 400px;
  max-width: 90vw;
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.ai-summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.ai-summary-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.ai-summary-close {
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s ease;
}

.ai-summary-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.ai-summary-content {
  padding: 16px;
  max-height: 300px;
  overflow-y: auto;
}

.ai-summary-text {
  line-height: 1.6;
  color: var(--text);
  white-space: pre-wrap;
}

.ai-summary-error {
  color: #ff6b6b;
  text-align: center;
  padding: 20px;
}

.ai-summary-loading {
  text-align: center;
  color: var(--muted);
  padding: 20px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .ai-summary-container {
    position: fixed;
    top: 16px;
    right: 16px;
  }
  
  .ai-summary-panel {
    width: calc(100vw - 32px);
    right: 0;
  }
  
  .ai-summary-btn {
    padding: 14px 22px;
    font-size: 15px;
  }
}
</style>
