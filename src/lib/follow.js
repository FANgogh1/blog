import { supabase } from './supabase';

// 从posts表中获取用户信息
const getUserInfoFromPosts = async (userId) => {
  try {
    const { data: postsData, error } = await supabase
      .from('posts')
      .select('author_name, author_avatar')
      .eq('author', userId)
      .limit(1);
    
    if (error || !postsData || postsData.length === 0) {
      return {
        id: userId,
        email: '用户',
        user_metadata: {
          nickname: '用户',
          avatar_url: ''
        }
      };
    }
    
    return {
      id: userId,
      email: '用户',
      user_metadata: {
        nickname: postsData[0].author_name || '用户',
        avatar_url: postsData[0].author_avatar || ''
      }
    };
  } catch (error) {
    console.error('从posts表获取用户信息失败:', error);
    return {
      id: userId,
      email: '用户',
      user_metadata: {
        nickname: '用户',
        avatar_url: ''
      }
    };
  }
};

/**
 * 关注用户
 * @param {string} targetUserId - 要关注的用户ID
 * @returns {Promise<Object>}
 */
export const followUser = async (targetUserId) => {
  try {
    // 获取当前用户
    const { data: userRes } = await supabase.auth.getUser();
    const currentUser = userRes?.user || userRes?.data?.user;
    
    if (!currentUser) {
      throw new Error('请先登录');
    }
    
    if (currentUser.id === targetUserId) {
      throw new Error('不能关注自己');
    }
    
    // 检查是否已经关注
    const { data: existingFollow } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', currentUser.id)
      .eq('following_id', targetUserId)
      .single();
    
    if (existingFollow) {
      throw new Error('已经关注该用户');
    }
    
    // 插入关注记录
    const { data, error } = await supabase
      .from('user_follows')
      .insert([{
        follower_id: currentUser.id,
        following_id: targetUserId,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * 取消关注用户
 * @param {string} targetUserId - 要取消关注的用户ID
 * @returns {Promise<Object>}
 */
export const unfollowUser = async (targetUserId) => {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const currentUser = userRes?.user || userRes?.data?.user;
    
    if (!currentUser) {
      throw new Error('请先登录');
    }
    
    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', currentUser.id)
      .eq('following_id', targetUserId);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * 检查是否已关注用户
 * @param {string} targetUserId - 要检查的用户ID
 * @returns {Promise<boolean>}
 */
export const isFollowing = async (targetUserId) => {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const currentUser = userRes?.user || userRes?.data?.user;
    
    if (!currentUser) return false;
    
    const { data, error } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', currentUser.id)
      .eq('following_id', targetUserId)
      .single();
    
    return !error && !!data;
  } catch (error) {
    return false;
  }
};

/**
 * 获取用户的关注数（关注了多少人）
 * @param {string} userId - 用户ID
 * @returns {Promise<number>}
 */
export const getFollowingCount = async (userId) => {
  try {
    const { count, error } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId);
    
    if (error) throw error;
    
    return count || 0;
  } catch (error) {
    console.error('获取关注数失败:', error);
    return 0;
  }
};

/**
 * 获取用户的粉丝数（被多少人关注）
 * @param {string} userId - 用户ID
 * @returns {Promise<number>}
 */
export const getFollowersCount = async (userId) => {
  try {
    const { count, error } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId);
    
    if (error) throw error;
    
    return count || 0;
  } catch (error) {
    console.error('获取粉丝数失败:', error);
    return 0;
  }
};

/**
 * 获取用户的关注列表
 * @param {string} userId - 用户ID
 * @returns {Promise<Array>}
 */
export const getFollowingList = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_follows')
      .select('following_id, created_at')
      .eq('follower_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // 为每个关注关系获取用户信息
    const followingList = [];
    for (const item of data || []) {
      const userInfo = await getUserInfoFromPosts(item.following_id);
      followingList.push({
        ...item,
        user: userInfo
      });
    }
    
    return followingList;
  } catch (error) {
    console.error('获取关注列表失败:', error);
    return [];
  }
};

/**
 * 获取用户的粉丝列表
 * @param {string} userId - 用户ID
 * @returns {Promise<Array>}
 */
export const getFollowersList = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_follows')
      .select('follower_id, created_at')
      .eq('following_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // 为每个粉丝关系获取用户信息
    const followersList = [];
    for (const item of data || []) {
      const userInfo = await getUserInfoFromPosts(item.follower_id);
      followersList.push({
        ...item,
        user: userInfo
      });
    }
    
    return followersList;
  } catch (error) {
    console.error('获取粉丝列表失败:', error);
    return [];
  }
};