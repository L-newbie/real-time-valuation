

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import { ElDialog, ElDropdown, ElDropdownMenu, ElDropdownItem, ElIcon, ElInput, ElPopover } from 'element-plus'
import 'element-plus/theme-chalk/base.css'
import 'element-plus/theme-chalk/el-dialog.css'
import 'element-plus/theme-chalk/el-overlay.css'
import 'element-plus/theme-chalk/el-dropdown.css'
import 'element-plus/theme-chalk/el-popper.css'
import 'element-plus/theme-chalk/el-tooltip.css'
import 'element-plus/theme-chalk/el-scrollbar.css'
import 'element-plus/theme-chalk/el-icon.css'
import 'element-plus/theme-chalk/el-input.css'
import 'element-plus/theme-chalk/el-popover.css'

import 'element-plus/theme-chalk/el-message.css'
import 'element-plus/theme-chalk/dark/css-vars.css'

import { Search, Close, Delete, Grid, List, Warning, InfoFilled } from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
import './assets/styles/main.css'
import { startFundModule } from './modules/fund/fund-bootstrap'
import { useSettingsStore } from './modules/settings/settings-store'
import { useCacheStore } from './modules/fund/cache-store'
import { useHoldingStore } from './modules/holding/holding-store'

const app = createApp(App)

for (const c of [ElDialog, ElDropdown, ElDropdownMenu, ElDropdownItem, ElIcon, ElInput, ElPopover]) {
  app.use(c)
}
for (const [name, icon] of Object.entries({ Search, Close, Delete, Grid, List, Warning, InfoFilled })) {
  app.component(name, icon)
}

app.use(createPinia())
app.use(router)

app.mount('#app')

useSettingsStore().initTheme()

// 切到后台时给 html 挂上标记，CSS 据此暂停无限动画。
// 列表里每行一个呼吸点，几十只自选就是几十个动画，
// 页面都看不见了还在烧电，没有意义。
import('./shared/net/page-visibility').then(({ onVisibilityChange, isPageVisible }) => {
  const apply = (visible: boolean) => {
    document.documentElement.classList.toggle('app-hidden', !visible)
  }
  apply(isPageVisible())
  onVisibilityChange(apply)
}).catch(() => {  })

void startFundModule()

import('./shared/version/version-checker').then(({ startVersionChecker }) => {
  startVersionChecker()
}).catch(() => {  })

import('./shared/prefetch/route-prefetch').then(({ startRoutePrefetch }) => {
  startRoutePrefetch()
}).catch(() => {  })

window.addEventListener('beforeunload', () => {
  if ((window as unknown as { __skipPersistOnUnload?: boolean }).__skipPersistOnUnload) return
  try {
    useCacheStore().flushPersist()
    useHoldingStore().flushAllPersist()
  } catch {  }
})
