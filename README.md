<p align="center">
  <img src="assets/logo.svg" alt="Cloudflare IP 优选助手 Logo" width="140">
</p>

# Cloudflare IP 优选助手

这是一个公开众测版 Cloudflare 优选 IP 项目。

OpenWrt 用户安装 LuCI 插件后，填写昵称并设置测速时间。插件会自动运行 `cfst`，上传测速结果。服务端会按省份和运营商聚合可信数据，并生成类似下面的域名：

```text
sx.cu.6610000.xyz
sh.ct.6610000.xyz
gd.cm.6610000.xyz
```

项目页面：[https://cf.6610000.xyz](https://cf.6610000.xyz)

## 功能

- OpenWrt / LuCI 插件自动测速并上传结果。
- 疑似代理出口的数据会保留贡献记录，但不参与 DNS 优选。
- 按省份和运营商聚合最佳 IP。
- 自动更新 `省份缩写.运营商.6610000.xyz` DNS。
- Web 页面展示 IP、速度、延迟、贡献者和最后同步时间。

## OpenWrt 安装

推荐一键安装：

```sh
sh -c "$(wget -O- https://raw.githubusercontent.com/10000ge10000/cf-ip-speed-panel/main/scripts/install-openwrt.sh)"
```

如果系统没有 `wget`，可以使用：

```sh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/10000ge10000/cf-ip-speed-panel/main/scripts/install-openwrt.sh)"
```

也可以到 Release 手动下载对应版本的两个包：

[https://github.com/10000ge10000/cf-ip-speed-panel/releases/tag/v0.1.4](https://github.com/10000ge10000/cf-ip-speed-panel/releases/tag/v0.1.4)

必须安装这两个包：

```text
cf-ip-speed-client
luci-app-cf-ip-speed-client
```

安装后进入 LuCI：

```text
服务 -> Cloudflare IP 优选助手
```

填写昵称，选择测速方式，然后启用即可。建议每天定时测速选择凌晨 3 点到 5 点，减少对正常上网的影响。

## 版本说明

- `.ipk`：适用于 OpenWrt 23 / 24 以及仍使用 `opkg` 的系统。
- `.apk`：适用于已经使用 `apk` 包管理器的新版本 OpenWrt / snapshot。
- 已发布 x86_64、ARM64、ARMv7、MIPS 常见平台包。

## 安全说明

- 插件不会保存 Cloudflare Token。
- OpenWrt 本机会保存 `device_id/device_token`，用于识别设备。
- 服务端只保存设备 token 的哈希，不保存明文 token。
- 疑似代理、云服务器出口、境外出口数据不会参与自动 DNS 优选。
