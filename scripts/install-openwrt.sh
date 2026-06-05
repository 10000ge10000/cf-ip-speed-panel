#!/bin/sh

set -eu

REPO="10000ge10000/cf-ip-speed-panel"
TAG="${TAG:-v0.1.3}"
BASE_URL="https://github.com/${REPO}/releases/download/${TAG}"
TMP_DIR="/tmp/cf-ip-speed-install"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "缺少命令：$1"
}

read_release_value() {
  key="$1"
  sed -n "s/^${key}='\\(.*\\)'/\\1/p" /etc/openwrt_release 2>/dev/null | head -n 1
}

detect_version() {
  release="$(read_release_value DISTRIB_RELEASE)"
  case "$release" in
    23.*) echo "23.05.5" ;;
    24.*) echo "24.10.6" ;;
    *Buddha*|*2026*) echo "24.10.6" ;;
    *) echo "${OPENWRT_BUILD_VERSION:-24.10.6}" ;;
  esac
}

detect_arch() {
  arch="$(read_release_value DISTRIB_ARCH)"
  if [ -z "$arch" ]; then
    arch="$(opkg print-architecture 2>/dev/null | awk 'NR==1{print $2}')"
  fi
  case "$arch" in
    x86_64|aarch64_cortex-a53|aarch64_cortex-a72|arm_cortex-a7_neon-vfpv4|mips_24kc) echo "$arch" ;;
    *) fail "当前架构暂未匹配到发布包：${arch:-unknown}。请到 GitHub Actions 手动构建对应平台。" ;;
  esac
}

download() {
  url="$1"
  output="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --connect-timeout 20 -o "$output" "$url"
  else
    wget --no-check-certificate -O "$output" "$url"
  fi
}

need_cmd opkg
need_cmd grep
need_cmd awk

version="$(detect_version)"
arch="$(detect_arch)"
release_part="${arch}-${version}"

case "$version" in
  23.05.5) package_release="-1" ;;
  24.10.6) package_release="-r1" ;;
  *) fail "当前版本暂未发布 Release 包：$version。请到 GitHub Actions 手动构建。" ;;
esac

client_file="${release_part}-cf-ip-speed-client_0.1.0${package_release}_${arch}.ipk"
luci_file="${release_part}-luci-app-cf-ip-speed-client_0.1.0${package_release}_${arch}.ipk"

echo "OpenWrt 版本：$version"
echo "系统架构：$arch"
echo "下载版本：$TAG"

mkdir -p "$TMP_DIR"
cd "$TMP_DIR"
rm -f cf-ip-speed-client.ipk luci-app-cf-ip-speed-client.ipk

download "${BASE_URL}/${client_file}" cf-ip-speed-client.ipk
download "${BASE_URL}/${luci_file}" luci-app-cf-ip-speed-client.ipk

cp /etc/config/cf_ip_speed_client /tmp/cf_ip_speed_client.backup 2>/dev/null || true
opkg install --force-reinstall ./cf-ip-speed-client.ipk ./luci-app-cf-ip-speed-client.ipk

/usr/bin/cf-ip-speed-client cron || true
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache
/etc/init.d/rpcd reload >/dev/null 2>&1 || /etc/init.d/rpcd restart >/dev/null 2>&1 || true
/etc/init.d/uhttpd reload >/dev/null 2>&1 || /etc/init.d/uhttpd restart >/dev/null 2>&1 || true

echo "安装完成。请进入 LuCI：服务 -> Cloudflare IP 优选助手"
echo "如果页面仍是旧内容，请浏览器强制刷新。"
