<script setup>
</script>

<template>
  <nav class="navbar">
    <div class="navbar-inner">
      <router-link to="/" class="brand">FlatBlog</router-link>
      <div class="nav">
        <router-link to="/">首页</router-link>
        <router-link to="/profile">个人中心</router-link>
        <router-link to="/login">登录</router-link>
        <router-link to="/register">注册</router-link>
      </div>
    </div>
  </nav>

  <div class="container">
    <router-view />
  </div>

  <footer class="footer">© 2025 FlatBlog</footer>
</template>

<style scoped>
/* 仅保留局部样式，其余使用全局 blog.css */
</style>