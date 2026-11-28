# 站内使用指南维护说明

## 用户体验

完成首次配置并进入雷达后，页面会自动打开一次“使用指南”。指南按顺序介绍：

1. 个人配置如何影响推荐。
2. 如何从今日重点开始阅读。
3. 如何切换内容视图、排序和数据源。
4. 如何使用每日阅读路线。
5. 何时需要连接 GitHub Token。

顶栏的“使用指南”按钮可以随时重新打开。用户点击“跳过”、关闭按钮、`Esc`
或完成最后一步后，浏览器会写入：

```text
signal-radar-guide-seen-v1 = 1
```

之后刷新页面不会再次自动打开；手动点击按钮仍然有效。

## 创建 GitHub Token

页面内“连接 GitHub”弹窗提供六步操作，并直接显示完整创建地址：

```text
https://github.com/settings/tokens/new?description=Interest%20Radar&scopes=
```

推荐使用 Classic Personal Access Token，名称填写 `Interest Radar`，有效期选择
30、60 或 90 天，所有 Scopes 均不勾选。项目只需要公开信息的只读请求。

## 实现边界

项目当前是原生 HTML/CSS/JavaScript，没有 React 运行时，因此没有直接引入
React Joyride。`app/js/guide.js` 只借鉴其稳定目标、显式步骤进度、关闭与持久化
思路，保持零第三方依赖。

如果以后把前端迁移到 React 或 Next.js，可以再评估
[`react-joyride`](https://github.com/gilbarbara/react-joyride) 的官方 Skill；
在本项目当前技术栈中不应强行套用。

## 修改引导

步骤定义在 `app/js/guide.js` 的 `steps` 数组中。每一步包含：

```js
{
  target: "#element-id",       // 当前可见元素的选择器
  title: "这一步说明什么",
  body: "给第一次使用者的具体说明",
  placement: "bottom"           // bottom、top 或 left
}
```

修改时需要同时检查：

- 目标元素是否在桌面和手机视图中可见。
- 新增步骤后，进度是否仍显示正确的 `n / total`。
- 目标缺失时是否仍有卡片说明，而不是整页报错。
- 选择器是否与 `app/index.html` 保持一致。

## 验证

启动服务后运行真实浏览器回归：

```powershell
py -3.12 -m server.app --host 127.0.0.1 --port 4183
node scripts\verify-ui.js http://127.0.0.1:4183/
```

当前回归覆盖：

- 首次进入自动打开。
- 点击按钮重新打开。
- 下一步进入第二步并显示 `2 / 5`。
- 跳过后写入完成状态。
- 刷新后不自动重开。
- 桌面与手机端无横向溢出。
- 浏览器控制台无错误。
