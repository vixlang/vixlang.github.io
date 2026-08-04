#!/bin/sh
# install.sh — Vix 官方安装脚本
#
# 部署地址: https://vix-lang.org/install.sh
# 用法:
#   curl -fsSL https://vix-lang.org/install.sh | sh                # 默认安装最新版
#   curl -fsSL https://vix-lang.org/install.sh | sh -s -- v0.4.6   # 指定版本
#   curl -fsSL https://vix-lang.org/install.sh | sh -s -- uninstall
#
# 依赖: curl, tar  （不依赖 Python / sudo）
# 安装位置: ~/.vix  （含 bin/ 与 versions/）

set -e

# ============================================================
# 常量
# ============================================================
GITHUB_REPO="vixlang/Vix-lang"
GITHUB_API="https://api.github.com/repos/${GITHUB_REPO}/releases/latest"
GITHUB_DOWNLOAD_BASE="https://github.com/${GITHUB_REPO}/releases/download"

VIX_HOME="${VIX_HOME:-$HOME/.vix}"
VIX_BIN_DIR="${VIX_HOME}/bin"
VIX_VERSIONS_DIR="${VIX_HOME}/versions"

PATH_LINE='export PATH="$HOME/.vix/bin:$PATH"'

# 颜色（仅在终端启用时输出，管道安装时保持纯净）
if [ -t 1 ]; then
    CLR_RESET='\033[0m'
    CLR_BOLD='\033[1m'
    CLR_GREEN='\033[32m'
    CLR_RED='\033[31m'
    CLR_DIM='\033[2m'
else
    CLR_RESET=''
    CLR_BOLD=''
    CLR_GREEN=''
    CLR_RED=''
    CLR_DIM=''
fi

# ============================================================
# 工具函数
# ============================================================
say()      { printf '%s\n' "$*"; }
say_bold() { printf "${CLR_BOLD}%s${CLR_RESET}\n" "$*"; }
say_ok()   { printf "${CLR_GREEN}%s${CLR_RESET}\n" "$*"; }
say_dim()  { printf "${CLR_DIM}%s${CLR_RESET}\n" "$*"; }
err()      { printf "${CLR_RED}error: %s${CLR_RESET}\n" "$*" >&2; }

need_cmd() {
    if ! command -v "$1" >/dev/null 2>&1; then
        err "未找到必需命令: $1"
        err "请先安装后重试。"
        exit 1
    fi
}

cleanup() {
    [ -n "${TMP_DIR:-}" ] && rm -rf "$TMP_DIR" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ============================================================
# 卸载
# ============================================================
do_uninstall() {
    say_bold "Uninstalling Vix..."

    if [ ! -d "$VIX_HOME" ]; then
        say "未找到 $VIX_HOME，无需卸载。"
        return 0
    fi

    rm -rf "$VIX_HOME"
    say_ok "✓ 已删除 $VIX_HOME"

    # 从 shell 配置中移除 PATH 行
    remove_path_from_rc "$HOME/.bashrc"
    remove_path_from_rc "$HOME/.zshrc"

    say ""
    say "PATH 配置已从 shell rc 文件中移除（如存在）。"
    say "请重新打开终端或执行: source ~/.bashrc / source ~/.zshrc"
}

remove_path_from_rc() {
    rc="$1"
    [ -f "$rc" ] || return 0
    if grep -qF "$PATH_LINE" "$rc" 2>/dev/null; then
        # 用临时文件原子替换，避免 sed -i 在 BSD/macOS 与 GNU 间的差异
        tmp="$(mktemp)"
        grep -vF "$PATH_LINE" "$rc" > "$tmp" 2>/dev/null || true
        mv "$tmp" "$rc"
        say_dim "  已从 $rc 移除 PATH 配置"
    fi
}

# ============================================================
# 平台检测
# ============================================================
detect_platform() {
    os="$(uname -s)"
    arch="$(uname -m)"

    case "$os" in
        Linux)
            case "$arch" in
                x86_64|amd64) PLATFORM="linux-x86_64"; ASSET="vixc-\${VERSION}-x86_64-linux.tar.gz" ;;
                *) err "不支持的 Linux 架构: $arch"; exit 1 ;;
            esac
            ;;
        Darwin)
            case "$arch" in
                arm64|aarch64) PLATFORM="macos-arm64"; ASSET="vixc-\${VERSION}-arm64-macos.tar.gz" ;;
                x86_64)
                    # Apple Silicon 上 uname -m 可能仍返回 x86_64（Rosetta）
                    if [ "$(sysctl -n hw.optional.arm64 2>/dev/null)" = "1" ]; then
                        PLATFORM="macos-arm64"; ASSET="vixc-\${VERSION}-arm64-macos.tar.gz"
                    else
                        err "不支持 Intel macOS，请使用 Apple Silicon 设备。"
                        exit 1
                    fi
                    ;;
                *) err "不支持的 macOS 架构: $arch"; exit 1 ;;
            esac
            ;;
        MINGW*|MSYS*|CYGWIN*|*_NT-*)
            cat >&2 <<'EOF'
error: 检测到 Windows 环境。
       请前往 GitHub Releases 下载 zip 包:
       https://github.com/vixlang/Vix-lang/releases
EOF
            exit 1
            ;;
        *)
            err "不支持的操作系统: $os"
            exit 1
            ;;
    esac
}

# ============================================================
# 版本获取
# ============================================================
resolve_version() {
    if [ -n "$1" ]; then
        VERSION="$1"
        # 去掉可能误带的 'v' 前缀再统一加回，兼容用户输入 "0.4.6" 或 "v0.4.6"
        case "$VERSION" in
            v*) : ;;
            *)  VERSION="v${VERSION}" ;;
        esac
        return 0
    fi

    say_dim "正在获取最新版本号..."
    # GitHub API 限流较严时不带 token 可能 403，这里做一次容错
    api_resp="$(curl -fsSL "$GITHUB_API" 2>/dev/null || true)"
    if [ -z "$api_resp" ]; then
        err "无法访问 GitHub API 获取最新版本。"
        err "请手动指定版本，例如: curl -fsSL https://vix-lang.org/install.sh | sh -s -- v0.4.6"
        exit 1
    fi
    # 兼容无 jq 环境：用 sed 提取首个 "tag_name" 字段
    VERSION="$(printf '%s' "$api_resp" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
    if [ -z "$VERSION" ]; then
        err "无法解析最新版本号。"
        err "请手动指定版本，例如: curl -fsSL https://vix-lang.org/install.sh | sh -s -- v0.4.6"
        exit 1
    fi
}

# ============================================================
# PATH 写入
# ============================================================
ensure_path_in_rc() {
    rc="$1"
    [ -f "$rc" ] || return 0

    if grep -qF "$PATH_LINE" "$rc" 2>/dev/null; then
        return 0  # 已存在，不重复添加
    fi

    # 追加到文件末尾，不覆盖用户配置
    {
        printf '\n# Added by Vix installer\n'
        printf '%s\n' "$PATH_LINE"
    } >> "$rc"
    say_dim "  已添加 PATH 配置到 $rc"
}

configure_path() {
    # bash
    if [ -n "${BASH_VERSION:-}" ] || [ -f "$HOME/.bashrc" ]; then
        ensure_path_in_rc "$HOME/.bashrc"
    fi
    # zsh
    if [ -n "${ZSH_VERSION:-}" ] || [ -f "$HOME/.zshrc" ]; then
        ensure_path_in_rc "$HOME/.zshrc"
    fi
}

# ============================================================
# 主安装流程
# ============================================================
install() {
    say_bold "Installing Vix..."
    say ""

    # 1. 依赖检查
    need_cmd curl
    need_cmd tar

    # 2. 版本解析
    resolve_version "$1"

    # 3. 平台检测
    say "Detecting platform..."
    detect_platform
    say "Found $PLATFORM"
    say ""

    # 4. 准备目录
    mkdir -p "$VIX_BIN_DIR" "$VIX_VERSIONS_DIR"

    # 5. 解析 asset 文件名（替换 ${VERSION} 占位）
    asset_name="$(printf '%s' "$ASSET" | sed "s/\${VERSION}/$VERSION/g")"
    download_url="${GITHUB_DOWNLOAD_BASE}/${VERSION}/${asset_name}"

    # 6. 下载
    say "Downloading Vix ${VERSION}..."
    TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t vix)"
    archive="${TMP_DIR}/${asset_name}"

    # --retry 提升弱网体验；GitHub 重定向到 CDN
    curl --proto '=https' --tlsv1.2 --fail --retry 3 --retry-delay 2 \
         -fsSL "$download_url" -o "$archive"

    # 7. 解压到独立版本目录
    version_dir="${VIX_VERSIONS_DIR}/${VERSION}"
    rm -rf "$version_dir"
    mkdir -p "$version_dir"
    tar -xzf "$archive" -C "$version_dir"

    # 8. 定位 vixc 二进制（兼容包内含 bin/ 子目录的情况）
    vixc_bin=""
    for candidate in \
        "${version_dir}/vixc" \
        "${version_dir}/bin/vixc" \
        "${version_dir}/vix-lang/vixc"; do
        if [ -f "$candidate" ]; then
            vixc_bin="$candidate"
            break
        fi
    done

    if [ -z "$vixc_bin" ]; then
        err "压缩包内未找到 vixc 可执行文件。"
        err "包内容:"
        (cd "$version_dir" && ls -la) >&2 || true
        exit 1
    fi

    # 9. 安装到 bin/ （用符号链接指向版本目录，便于多版本切换）
    say "Installing compiler..."
    chmod +x "$vixc_bin"

    target="${VIX_BIN_DIR}/vixc"
    # 若已存在旧链接/文件，先移除
    rm -f "$target"
    ln -s "$vixc_bin" "$target"

    # 10. 配置 PATH
    say ""
    say "Configuring PATH..."
    configure_path

    # 11. 完成
    say ""
    say_ok "✓ Vix installed successfully!"
    say ""
    say "Version:  $VERSION"
    say "Location: $target"
    say ""
    say_bold "Run:"
    say "  vixc --version"
    say ""
    # 若当前 shell PATH 尚未包含安装目录，给出即时提示
    case ":${PATH}:" in
        *":${VIX_BIN_DIR}:"*) ;;
        *)
            say_dim "注: 当前 shell 尚未识别 vixc，请执行以下命令或重开终端:"
            say_dim "    export PATH=\"\$HOME/.vix/bin:\$PATH\""
            say ""
            ;;
    esac
}

# ============================================================
# 入口
# ============================================================
main() {
    arg="${1:-}"

    case "$arg" in
        -h|--help|help)
            cat <<'EOF'
Vix 官方安装脚本

用法:
  curl -fsSL https://vix-lang.org/install.sh | sh                # 安装最新版
  curl -fsSL https://vix-lang.org/install.sh | sh -s -- v0.4.6   # 安装指定版本
  curl -fsSL https://vix-lang.org/install.sh | sh -s -- uninstall

环境变量:
  VIX_HOME   安装根目录，默认 ~/.vix
EOF
            exit 0
            ;;
        uninstall)
            do_uninstall
            ;;
        *)
            install "$arg"
            ;;
    esac
}

main "$@"
