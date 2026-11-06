Gakuten 阿里云同步优化（2026-11-06）

本次仅发布前端。基线是 GitHub `main` 的 `2ac4eb70f8`，已核对线上 HTML 与核心 JS 一致。后端使用现有快照、事务字段合并及 manifest 接口；不修改 ClassTango、数据库结构或学生记录。

- 修改立即持久化到既有浏览器存储，连同 pending / in-flight 队列一起保存。
- 自动上传：停顿 2 秒；连续输入最多约 8 秒一批，常规请求起始间隔至少 4 秒。手动同步立即发起。
- 可见页面每 12 秒读取约 116 字节的版本信息，变化后才读取完整快照；切回网页、联网、登录后主动恢复。
- 失败保留队列，3–60 秒退避；不直接重发结果未知的旧 POST。关闭页面只持久化，重开后重新读取、合并、补传。
- 上传确认核验房间、操作 ID、提交时间、revision 和完整数据结构，并应用后端实际合并结果。等待队列存在时显示待同步。
- 自动分项总分合并对齐现有后端规则；历史手工总分及缺考记录保持既有处理方式。

本地构建：`python3 build.py`。入口只更新 core / features 两个内容哈希引用；`src/release/Gakuten-2.0.base.html` 及其引用的已有资源是受版本管理的构建输入。原维护构建器和旧源码保留在本地，本次不使用。

验证使用现有 `tests/fixtures/statistics.json`、两个隔离 Chromium 上下文和现有后端 `createApp`，SQLite 只在内存中运行，不访问真实成绩。单个针对性测试为 `tests/test-aliyun-sync.cjs`，参数依次为构建目录、后端仓库路径；需要 Node 24 和 Playwright。覆盖连续输入、并发及乱序写入、分项/总分、历史手工总分、删除与新增、请求中继续编辑、响应丢失、断网/重开/重连、数据库完整性。后端已有 51 项测试全部通过；macOS 运行时 TMPDIR 需指向实体路径，避免 `/var` 与 `/private/var` 的路径断言差异。

部署需使用已通过验证的完整提交 SHA，在服务器现有 `/home/admin/nekosensei-web-src/chengji` 仓库执行：

```bash
git -c http.version=HTTP/1.1 fetch origin feature/gakuten-sync-optimization-20261106
commit=$(git rev-parse origin/feature/gakuten-sync-optimization-20261106)
git show "$commit:scripts/deploy-gakuten-sync.sh" > /tmp/deploy-gakuten-sync.sh
bash /tmp/deploy-gakuten-sync.sh --check "$commit"
# 核对上述 SHA 与已验收版本一致，获得生产操作确认后：
bash /tmp/deploy-gakuten-sync.sh --apply "$commit"
```

`--check` 不修改生产文件或数据库，核对当前前端基线、Gakuten 后端两个模块的已知版本、服务状态、健康接口和新资源。路径或哈希不符时停止，不能绕过检查或用 main 覆盖后端。

`--apply` 先用 SQLite 在线备份 API 创建当前备份，检查完整性并记录实际最新 revision、四类数据数量、数据库 SHA-256、前端提交；再备份静态代码，先上传新哈希 JS，最后原子替换入口 HTML。无需重启后端。公开入口验证失败会自动回退入口。备份位于 `/var/backups/nekosensei-sync/gakuten-frontend-时间/`。

按脚本输出执行代码回退即可，始终保留生产数据库的新写入。发布后用正常教学操作确认一次录分、云端确认与另一台设备自动更新；不要用测试请求修改正式成绩。已打开的旧网页需在本机保存完成后重新打开，才能加载新版。
