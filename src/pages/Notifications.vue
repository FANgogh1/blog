<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '../lib/supabase';

const loading = ref(false);
const errorMsg = ref('');
const items = ref([]);

// 获取用户信息（优先从user_profiles表获取最新信息）
const getUserInfoFromProfiles = async (userId) => {
  try {
    // 1. 首先尝试从user_profiles表获取
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (!profileError && profileData) {
      return { 
        nickname: profileData.nickname || '用户', 
        avatar_url: profileData.avatar_url || '' 
      };
    }
    
    // 2. 如果user_profiles表没有数据，尝试从通知表中获取历史记录
    const { data: notificationsData, error: notificationsError } = await supabase
      .from('notifications')
      .select('actor_name, actor_avatar')
      .eq('actor', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!notificationsError && notificationsData && notificationsData.length > 0) {
      return { 
        nickname: notificationsData[0].actor_name || '用户', 
        avatar_url: notificationsData[0].actor_avatar || '' 
      };
    }
    
    // 3. 如果都没有数据，返回默认值
    return { nickname: '用户', avatar_url: '' };
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return { nickname: '用户', avatar_url: '' };
  }
};

const fetchNotifications = async () => {
  loading.value = true; errorMsg.value = '';
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id || userRes?.data?.user?.id || null;
  if (!uid) { loading.value = false; items.value = []; errorMsg.value = '请先登录'; return; }
  
  try {
    // 同时获取普通通知和关注通知
    const [notificationsResult, followNotificationsResult] = await Promise.all([
      supabase
        .from('notifications')
        .select('*')
        .eq('recipient', uid)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('follow_notifications')
        .select('*')
        .eq('recipient', uid)
        .order('created_at', { ascending: false })
        .limit(100)
    ]);
    
    if (notificationsResult.error) {
      console.error('获取普通通知失败:', notificationsResult.error);
    }
    
    if (followNotificationsResult.error) {
      console.error('获取关注通知失败:', followNotificationsResult.error);
    }
    
    // 合并通知并排序
    let allNotifications = [
      ...(notificationsResult.data || []).map(n => ({
        ...n,
        source: 'notifications',
        type: n.type || 'unknown'
      })),
      ...(followNotificationsResult.data || []).map(n => ({
        ...n,
        source: 'follow_notifications',
        type: 'follow'
      }))
    ];
    
    // 对每个通知的操作者同步获取最新的用户信息
    if (allNotifications.length > 0) {
      try {
        // 并行处理所有用户信息查询
        const userInfoPromises = allNotifications.map(notification => {
          if (notification.actor) {
            return getUserInfoFromProfiles(notification.actor).then(userInfo => ({
              ...notification,
              actor_name: userInfo.nickname,
              actor_avatar: userInfo.avatar_url
            }));
          }
          return Promise.resolve(notification);
        });
        
        const updatedNotifications = await Promise.all(userInfoPromises);
        allNotifications = updatedNotifications;
      } catch (error) {
        console.error('更新用户信息失败:', error);
        // 如果更新失败，继续使用原始数据
      }
    }
    
    // 按创建时间排序
    items.value = allNotifications.sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
    
  } catch (err) {
    console.error('加载通知失败:', err);
    errorMsg.value = '加载通知失败';
  } finally {
    loading.value = false;
  }
};

const markRead = async (n) => {
  if (!n?.id) return;
  
  // 根据通知来源选择正确的表
  const tableName = n.source === 'follow_notifications' ? 'follow_notifications' : 'notifications';
  
  const { error } = await supabase
    .from(tableName)
    .update({ read: true })
    .eq('id', n.id);
  
  if (error) {
    errorMsg.value = error.message || '标记已读失败';
    return;
  }
  
  n.read = true;
  window.dispatchEvent(new CustomEvent('refresh-unread'));
};

onMounted(() => {
  fetchNotifications();
  window.addEventListener('refresh-unread', fetchNotifications);
});
</script>

<template>
  <div class="card" style="padding:20px; max-width: 1200px; margin: 0 auto;">
    <h2 style="margin:0 0 12px;">通知</h2>
    <div v-if="loading">加载中...</div>
    <div v-if="errorMsg" style="color:#ff6b6b;">{{ errorMsg }}</div>
    <div v-if="!loading && !items.length" style="color:var(--muted);">暂无通知</div>
    <ul v-else style="display:grid; gap:8px; list-style:none; padding:0; margin:0;">
      <li v-for="n in items" :key="n.id" class="card" style="padding:12px; display:flex; align-items:center; gap:8px;">
        <div style="display:flex; align-items:center; gap:8px; flex:1;">
          <span :style="{ 
            color: n.type==='comment' ? '#2b9e6e' : n.type==='like' ? '#1f7aec' : '#ff6b35', 
            fontWeight: 600 
          }">
            {{ n.type==='comment' ? '评论' : n.type==='like' ? '点赞' : '关注' }}
          </span>
          <span style="display:inline-flex; align-items:center; gap:8px;">
            <img v-if="n.actor_avatar" :src="n.actor_avatar" alt="avatar" style="width:22px; height:22px; border-radius:50%; object-fit:cover; border:1px solid var(--border);" />
            <span v-else style="width:22px; height:22px; border-radius:50%; background:#163229; display:flex; align-items:center; justify-content:center; font-size:11px; color:var(--primary); font-weight:700;">
              {{ (n.actor_name || '用户').slice(0,1).toUpperCase() }}
            </span>
            <span style="color:var(--text);">{{ n.actor_name || '用户' }}</span>
          </span>
          <span v-if="n.type !== 'follow'" style="color:var(--muted);">文章：{{ n.post_title || ('#' + n.post_id) }}</span>
          <span v-if="n.content && n.type !== 'follow'" style="color:var(--text);">内容：{{ n.content }}</span>
          <span v-if="n.type === 'follow'" style="color:var(--muted);">关注了你</span>
          <span style="margin-left:auto; font-size:12px; color:var(--muted);">{{ new Date(n.created_at).toLocaleString() }}</span>
        </div>
        <router-link v-if="n.type !== 'follow'" class="btn" :to="{ name: 'post', params: { id: n.post_id } }">前往文章</router-link>
        <router-link v-if="n.type === 'follow'" class="btn" :to="{ name: 'user', params: { id: n.actor } }">查看用户</router-link>
        <button class="btn" v-if="!n.read" @click="markRead(n)">标记已读</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
</style>