<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const id = computed(() => String(route.params.id));
const title = computed(() => ({
  '1': '用 Vue 3 构建扁平化博客 UI',
  '2': '前端性能优化 10 条实用建议',
  '3': 'CSS 扁平化设计指南',
}[id.value] || '示例文章'));

const content = ref(`这是示例文章内容，仅用于演示页面结构。
你可以替换为后端返回的 Markdown/HTML。
末尾提供点赞与评论功能（本地存储）。`);

const likeKey = computed(() => `flatblog:likes:${id.value}`);
const commentKey = computed(() => `flatblog:comments:${id.value}`);

const likes = ref(0);
const comments = ref([]);

const like = () => {
  likes.value += 1;
  localStorage.setItem(likeKey.value, String(likes.value));
};

const newComment = ref('');
const addComment = () => {
  const text = newComment.value?.trim();
  if (!text) return;
  const item = { text, time: new Date().toLocaleString() };
  comments.value = [item, ...comments.value];
  localStorage.setItem(commentKey.value, JSON.stringify(comments.value));
  newComment.value = '';
};

onMounted(() => {
  const l = Number(localStorage.getItem(likeKey.value) || 0);
  likes.value = Number.isFinite(l) ? l : 0;
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
      <button class="btn primary" @click="like">点赞 👍</button>
      <span style="color:var(--muted);">已获赞：{{ likes }}</span>
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