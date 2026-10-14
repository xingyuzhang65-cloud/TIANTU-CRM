# 天图 CRM

面向跨境物流销售团队的 CRM App，使用 Expo、React Native 和 React Native Web。

- [在线 App](https://xingyuzhang65-cloud.github.io/TIANTU-CRM/web/)
- [管理端](https://xingyuzhang65-cloud.github.io/TIANTU-CRM/admin/)

演示账号：`admin`，密码：`123456`。GitHub Pages 和 localhost 使用演示接口；客户、线索、跟进、询价、动态及配置变更保存在当前浏览器中，管理端与 App 的演示数据分别保存。

## 功能

- 工作台：业务概览、待办、客户进展、货量与账期风险。
- 客户：我的客户、公司池、即将掉保、成交客户和全部视图；搜索、筛选、认领、阶段更新、带图片跟进。
- 线索：创建、私海与公海查看、认领、跟进、转为客户。
- 业务：询价、报价、智能核价、报价复制、运单跟踪与异常查看。
- 动态与我的：团队动态发布、图片、点赞、账号安全和公海参数配置。

## 本地开发

```sh
cd mobile
npm ci
npm run web
```

## GitHub Pages 发布

源码使用 `master`；Pages 从 `gh-pages` 分支根目录发布。App 静态资源放在 `app/`，`/web/` 和根目录使用同一入口。现有 `admin/` 管理端单独保留。

```sh
cd mobile
npm run export:web
cd ..
git fetch origin gh-pages:refs/remotes/origin/gh-pages
git worktree add ../tiantu-pages gh-pages
node prepare-pages.cjs ../tiantu-pages
git -C ../tiantu-pages diff --stat
git -C ../tiantu-pages add app index.html web/index.html
git -C ../tiantu-pages commit -m "Deploy CRM App"
git -C ../tiantu-pages push origin HEAD:gh-pages
```

首次在单分支克隆中创建发布工作区，可将 worktree 命令改为 `git worktree add -b gh-pages ../tiantu-pages origin/gh-pages`。发布脚本仅准备文件，提交前检查差异。

## 页面验证

测试使用独立浏览器上下文，检查登录、搜索、刷新恢复、认领和详情归属、客户及线索跟进图片、线索转客户、询价、运单、动态发布和 360/390/480/1440px 布局。

在 `mobile/` 安装可选验证工具 `npm install --no-save playwright`、`npx playwright install chromium`，启动本地静态预览后，在仓库根目录运行 `node --test verify-app.cjs`。默认地址为 `http://127.0.0.1:4173/TIANTU-CRM/web/`；可通过 `TIANTU_APP_URL` 指定测试地址。截图与结果保存在 `qa/`。
