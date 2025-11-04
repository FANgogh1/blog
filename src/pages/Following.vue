<script setup>
import { ref, onMounted, computed } from 'vue';
import { supabase } from '../lib/supabase';
import { getFollowingList } from '../lib/follow';

const loading = ref(true);
const errorMsg = ref('');
const posts = ref([]);
const currentUser = ref(null);
const hasFetched = ref(false); // 防止重复调用

// 获取已关注用户的文章
const fetchFollowingPosts = async () => {
  // 防止重复调用
  if (loading.value || hasFetched.value) return;
  
  loading.value = true;
  errorMsg.value = '';
  
  try {
    // 获取当前用户（只在首次调用时获取）
    if (!currentUser.value) {
      const { data: userRes } = await supabase.auth.getUser();
      currentUser.value = userRes?.user || null;
    }
    
    if (!currentUser.value) {
      errorMsg.value = '请先登录';
      posts.value = [];
      hasFetched.value = true;
      return;
    }
    
    // 获取关注列表
    const followingList = await getFollowingList(currentUser.value.id);
    
    if (followingList.length === 0) {
      posts.value = [];
      hasFetched.value = true;
      return;
    }
    
    // 获取已关注用户的文章
    const followingIds = followingList.map(item => item.following_id);
    
    const { data: postsData, error } = await supabase
      .from('posts')
      .select('*')
      .in('author', followingIds)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    posts.value = postsData || [];
    hasFetched.value = true;
    
  } catch (error) {
    console.error('获取关注文章失败:', error);
    errorMsg.value = '加载失败，请重试';
    posts.value = [];
    hasFetched.value = true; // 即使出错也标记为已获取，防止无限重试
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchFollowingPosts();
});

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

// 获取文章摘要
const getExcerpt = (content) => {
  if (!content) return '';
  // 移除HTML标签
  const text = content.replace(/<[^>]+>/g, '');
  // 截取前100个字符
  return text.length > 100 ? text.slice(0, 100) + '...' : text;
};
</script>

<template>
  <div class="card" style="max-width:960px; margin:0 auto; padding:30px;">
    <h2 style="margin:0 0 16px;">关注动态</h2>
    <div style="color:var(--muted); margin-bottom:20px;">
      这里显示你关注的人发布的文章
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" style="text-align:center; padding:40px; color:var(--muted);">
      <div>加载中...</div>
    </div>

    <!-- 未登录提示 -->
    <div v-else-if="!currentUser" class="card" style="padding:20px; text-align:center; background:var(--card-bg);">
      <div style="color:var(--muted); margin-bottom:16px;">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6;">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="8.5" cy="7" r="4"></circle>
          <line x1="20" y1="8" x2="20" y2="14"></line>
          <line x1="23" y1="11" x2="17" y2="11"></line>
        </svg>
      </div>
      <h3 style="margin:0 0 8px; color:var(--text);">请先登录</h3>
      <p style="color:var(--muted); margin:0 0 16px;">登录后可以查看你关注的人发布的文章</p>
      <router-link to="/login" class="btn primary">立即登录</router-link>
    </div>

    <!-- 错误提示 -->
    <div v-else-if="errorMsg" class="card" style="padding:16px; background:#fff5f5; border:1px solid #ffccc7;">
      <div style="color:#ff4d4f; display:flex; align-items:center; gap:8px;">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        {{ errorMsg }}
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="posts.length === 0" class="card" style="padding:40px; text-align:center; background:var(--card-bg);">
      <div style="color:var(--muted); margin-bottom:16px;">
        <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6;">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
        </svg>
      </div>
      <h3 style="margin:0 0 8px; color:var(--text);">暂无关注文章</h3>
      <p style="color:var(--muted); margin:0 0 16px;">你关注的人还没有发布文章，或者你还没有关注任何人</p>
      <div style="display:flex; gap:12px; justify-content:center;">
        <router-link to="/" class="btn">浏览首页</router-link>
        <router-link to="/hot" class="btn primary">查看热榜</router-link>
      </div>
    </div>

    <!-- 文章列表 -->
    <div v-else class="grid cols-2">
      <router-link 
        v-for="post in posts" 
        :key="post.id" 
        class="card" 
        :to="{ name: 'post', params: { id: post.id } }" 
        style="padding:20px; text-decoration:none; color:inherit; display:flex; flex-direction:column; height:100%; transition:transform 0.2s;"
        @mouseenter="$event.currentTarget.style.transform = 'translateY(-2px)'"
        @mouseleave="$event.currentTarget.style.transform = 'translateY(0)'"
      >
        <h3 style="margin:0 0 12px; font-size:18px; line-height:1.4; color:var(--text);">{{ post.title }}</h3>
        
        <!-- 作者信息 -->
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
          <router-link 
            :to="{ name: 'user', params: { id: post.author } }" 
            style="text-decoration:none; color:inherit; display:flex; align-items:center; gap:8px;"
            @click.stop
          >
            <img 
              v-if="post.author_avatar" 
              :src="post.author_avatar" 
              alt="avatar" 
              style="width:24px; height:24px; border-radius:50%; object-fit:cover; border:1px solid var(--border);" 
            />
            <div 
              v-else 
              style="width:24px; height:24px; border-radius:50%; background:#163229; display:flex; align-items:center; justify-content:center; font-size:12px; color:var(--primary); font-weight:700;"
            >
              {{ (post.author_name || '匿名').slice(0,1).toUpperCase() }}
            </div>
            <span style="font-weight:500; color:var(--text);">{{ post.author_name || '匿名' }}</span>
          </router-link>
          <span style="margin-left:auto; font-size:12px; color:var(--muted);">{{ formatDate(post.created_at) }}</span>
        </div>
        
        <!-- 文章摘要 -->
        <p style="color:var(--muted); margin:0 0 16px; line-height:1.5; flex:1;">{{ getExcerpt(post.content) }}</p>
        
        <!-- 操作按钮 -->
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="btn primary" style="pointer-events:none; font-size:14px;">阅读全文</span>
          <span style="font-size:12px; color:var(--muted);">来自关注</span>
        </div>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.grid.cols-2 {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

@media (max-width: 768px) {
  .grid.cols-2 {
    grid-template-columns: 1fr;
  }
}

.card {
  transition: all 0.2s ease;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style>