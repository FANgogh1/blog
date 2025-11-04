<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '../lib/supabase';

const loading = ref(true);
const errorMsg = ref('');
const items = ref([]); // [{ post, likeCount }]

const fetchHot = async () => {
  loading.value = true;
  errorMsg.value = '';
  try {
    // 1) 拉取所有点赞的 post_id，再在前端聚合计数（简化实现）
    const { data: likes, error: likeErr } = await supabase
      .from('post_likes')
      .select('post_id');
    if (likeErr) throw likeErr;

    const countMap = new Map();
    (likes || []).forEach(l => {
      const k = l.post_id;
      countMap.set(k, (countMap.get(k) || 0) + 1);
    });

    let posts = [];
    if (countMap.size > 0) {
      const ids = Array.from(countMap.keys());
      const { data: postsRes, error: postErr } = await supabase
        .from('posts')
        .select('*')
        .in('id', ids);
      if (postErr) throw postErr;
      posts = postsRes || [];
      // 组合并按点赞数降序
      const mapById = new Map(posts.map(p => [p.id, p]));
      items.value = ids
        .map(id => ({ post: mapById.get(id), likeCount: countMap.get(id) || 0 }))
        .filter(it => !!it.post)
        .sort((a, b) => b.likeCount - a.likeCount);
    } else {
      // 无点赞数据：按时间降序展示最近文章，点赞数视为 0
      const { data: postsRes, error: postErr } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (postErr) throw postErr;
      posts = postsRes || [];
      items.value = posts.map(p => ({ post: p, likeCount: 0 }));
    }
  } catch (e) {
    errorMsg.value = e?.message || '加载失败';
    items.value = [];
  } finally {
    loading.value = false;
  }
};

onMounted(fetchHot);
</script>

<template>
  <div>
    <h2 style="margin:0 0 16px;">热榜</h2>
    <div style="color:var(--muted); margin-bottom:12px;">注：排行依据博客点赞数量</div>

    <div v-if="loading" style="color:var(--muted);">加载中...</div>
    <div v-else-if="errorMsg" style="color:#ff6b6b;">{{ errorMsg }}</div>
    <div v-else-if="!items.length" style="color:var(--muted);">暂无数据</div>

    <div v-else class="grid cols-3">
      <router-link v-for="it in items" :key="it.post.id" class="card" :to="{ name: 'post', params: { id: it.post.id } }" style="padding:16px; text-decoration:none; color:inherit; display:flex; flex-direction:column; height:100%; position:relative;">
        <h3 style="margin:0 0 8px;">{{ it.post.title }}</h3>
        <div style="display:flex; align-items:center; gap:10px; color:var(--muted); margin-bottom:10px;">
          <img v-if="it.post.author_avatar" :src="it.post.author_avatar" alt="avatar" style="width:24px; height:24px; border-radius:50%; object-fit:cover; border:1px solid var(--border);" />
          <div v-else style="width:24px; height:24px; border-radius:50%; background:#163229; display:flex; align-items:center; justify-content:center; font-size:12px; color:var(--primary); font-weight:700;">
            {{ (it.post.author_name || '匿名').slice(0,1).toUpperCase() }}
          </div>
          <span>{{ it.post.author_name || '匿名' }}</span>
          <span style="margin-left:auto; font-size:12px;">{{ it.post.created_at ? new Date(it.post.created_at).toLocaleString() : '' }}</span>
        </div>
        <p style="color:var(--muted); margin:0;">{{ (it.post.content || '').replace(/<[^>]+>/g, '')?.slice(0, 80) }}</p>
        
        <!-- 获赞数徽章 - 左下角 -->
        <div style="position:absolute; left:16px; bottom:16px;">
          <span class="badge" style="background:var(--primary); color:#fff; padding:2px 8px; border-radius:999px; font-size:12px;">
            获赞数{{ it.likeCount }}
          </span>
        </div>
        
        <div style="margin-top:auto; display:flex; justify-content:flex-end; gap:8px;">
          <span class="btn primary" style="pointer-events:none;">查看详情</span>
        </div>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
</style>