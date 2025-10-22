<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { supabase } from '../lib/supabase';

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
  <article class="card" style="padding:20px;">
    <h1 style="margin:0 0 8px;">{{ title }}</h1>
    <div style="display:flex; align-items:center; gap:10px; color:var(--muted); margin-bottom:12px;">
      <img v-if="authorAvatar" :src="authorAvatar" alt="avatar" style="width:28px; height:28px; border-radius:50%; object-fit:cover; border:1px solid var(--border);" />
      <div v-else style="width:28px; height:28px; border-radius:50%; background:#163229; display:flex; align-items:center; justify-content:center; font-size:12px; color:var(--primary); font-weight:700;">
        {{ (authorName || '匿名').slice(0,1).toUpperCase() }}
      </div>
      <span>{{ authorName || '匿名' }}</span>
      <span style="margin-left:auto; font-size:12px;">{{ publishTime ? `发布于 ${publishTime}` : '' }} · 文章 ID：{{ id }}</span>
    </div>
    <!-- 编辑操作：仅作者可见 -->
    <div v-if="ownPost" style="display:flex; gap:8px; margin-bottom:12px;">
      <button class="btn" @click="startEdit">编辑</button>
      <button class="btn" :disabled="deleteLoading" @click="deletePost">{{ deleteLoading ? '删除中...' : '删除' }}</button>
    </div>

    <!-- 内容/编辑表单 -->
    <div v-if="!editMode" style="white-space:pre-wrap; margin-bottom:20px;">{{ content }}</div>
    <div v-else class="card" style="padding:12px; display:grid; gap:10px; margin-bottom:16px;">
      <label>
        标题
        <input class="input" v-model="editForm.title" />
      </label>
      <label>
        内容
        <textarea class="input" v-model="editForm.content" style="min-height:160px; resize:vertical;"></textarea>
      </label>
      <div style="display:flex; gap:8px; align-items:center;">
        <button class="btn primary" :disabled="editSaving" @click="saveEdit">{{ editSaving ? '保存中...' : '保存' }}</button>
        <button class="btn" @click="cancelEdit">取消</button>
      </div>
      <div v-if="editError" style="color:#ff6b6b;">{{ editError }}</div>
    </div>

    <div style="display:flex; gap:12px; align-items:center; margin-bottom:16px;">
      <button class="btn primary" :disabled="likeLoading" @click="like">
        {{ likeLoading ? '处理中...' : (liked ? '取消点赞' : '点赞 👍') }}
      </button>
      <span style="color:var(--muted);">赞数：{{ likeCount }}</span>
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
</template>
