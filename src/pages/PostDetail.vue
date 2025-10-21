<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { supabase } from '../lib/supabase';

const route = useRoute();
const id = computed(() => String(route.params.id));

const title = ref('加载中...');
const content = ref('');

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
    likeLoading.value = false;
    likeError.value = '已点赞过';
    return;
  }
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

/* 评论仍用本地存储 */
const commentKey = computed(() => `flatblog:comments:${id.value}`);
const comments = ref([]);

const newComment = ref('');
const addComment = () => {
  const text = newComment.value?.trim();
  if (!text) return;
  const item = { text, time: new Date().toLocaleString() };
  comments.value = [item, ...comments.value];
  localStorage.setItem(commentKey.value, JSON.stringify(comments.value));
  newComment.value = '';
};

onMounted(async () => {
  const { data, error } = await supabase.from('posts').select('*').eq('id', id.value).single();
  if (!error && data) {
    title.value = data.title;
    content.value = data.content;
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

  // 评论加载（本地）
  try {
    comments.value = JSON.parse(localStorage.getItem(commentKey.value) || '[]');
  } catch { comments.value = []; }
});
</script>

<template>
  <article class="card" style="padding:20px;">
    <h1 style="margin:0 0 12px;">{{ title }}</h1>
    <div style="color:var(--muted); margin-bottom:16px;">文章 ID：{{ id }}</div>
    <div style="white-space:pre-wrap; margin-bottom:20px;">{{ content }}</div>

    <div style="display:flex; gap:12px; align-items:center; margin-bottom:16px;">
      <button class="btn primary" :disabled="liked || likeLoading" @click="like">
        {{ liked ? '已点赞 👍' : (likeLoading ? '点赞中...' : '点赞 👍') }}
      </button>
      <span style="color:var(--muted);">赞数：{{ likeCount }}</span>
      <span v-if="likeError" style="color:#ff6b6b;">{{ likeError }}</span>
    </div>

    <div class="card" style="padding:16px; border:1px dashed var(--border);">
      <h3 style="margin:0 0 12px;">评论</h3>
      <div style="display:flex; gap:8px; margin-bottom:12px;">
        <input class="input" v-model="newComment" placeholder="写下你的看法..." />
        <button class="btn" @click="addComment">发表</button>
      </div>
      <div v-if="comments.length === 0" style="color:var(--muted);">暂无评论</div>
      <ul v-else style="list-style:none; padding:0; margin:0; display:grid; gap:10px;">
        <li v-for="(c, i) in comments" :key="i" class="card" style="padding:12px;">
          <div style="margin-bottom:6px;">{{ c.text }}</div>
          <div style="color:var(--muted); font-size:12px;">{{ c.time }}</div>
        </li>
      </ul>
    </div>
  </article>
</template>

<style scoped>
</style>