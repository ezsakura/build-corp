#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

GITHUB_REPOSITORY='ezsakura/build-corp'
APP_DIR='/opt/build-corp'

fail() {
  printf 'Ошибка: %s\n' "$1" >&2
  exit 1
}

ask() {
  local variable_name="$1" prompt="$2" default_value="$3" value
  read -r -p "$prompt [$default_value]: " value
  printf -v "$variable_name" '%s' "${value:-$default_value}"
}

ask_secret() {
  local variable_name="$1" prompt="$2" value
  read -r -s -p "$prompt (Enter — сгенерировать): " value
  printf '\n'
  if [[ -z "$value" ]]; then
    value="$(openssl rand -hex 16)"
    printf 'Сгенерирован новый пароль администратора; сохраните его после завершения установки.\n'
    GENERATED_ADMIN_PASSWORD="$value"
  fi
  [[ "$value" =~ ^[A-Za-z0-9_-]{12,128}$ ]] || fail 'Используйте в пароле не менее 12 символов: латинские буквы, цифры, _ или -.'
  printf -v "$variable_name" '%s' "$value"
}

env_value() {
  sed -n "s/^$1=//p" .env | head -n 1
}

set_env_value() {
  local key="$1" value="$2" tmp_env
  tmp_env="$(mktemp .env.XXXXXX)"
  awk -v key="$key" -v value="$value" '
    BEGIN { replaced = 0 }
    index($0, key "=") == 1 {
      if (!replaced) print key "=" value
      replaced = 1
      next
    }
    { print }
    END { if (!replaced) print key "=" value }
  ' .env > "$tmp_env"
  chmod 600 "$tmp_env"
  mv "$tmp_env" .env
}

remove_env_value() {
  local key="$1"
  sed -i "/^${key}=/d" .env
}

[[ "$EUID" -eq 0 ]] || fail 'Запустите установку через sudo: sudo bash deploy.sh.'
mkdir -p "$APP_DIR"
cd "$APP_DIR"

install_docker() {
  [[ "$EUID" -eq 0 ]] || fail 'Для установки Docker запустите скрипт через sudo: sudo bash deploy.sh.'
  command -v apt-get >/dev/null 2>&1 || fail 'Автоустановка поддерживается на Ubuntu/Debian с apt. Установите Docker Engine и Compose plugin вручную.'
  [[ -r /etc/os-release ]] || fail 'Не удалось определить Linux-дистрибутив.'
  . /etc/os-release
  case "${ID:-}" in
    ubuntu|debian) ;;
    *) fail "Автоустановка Docker поддерживается на Ubuntu/Debian; обнаружен ${ID:-unknown}." ;;
  esac
  local repository_id="$ID" codename="${VERSION_CODENAME:-}" architecture
  [[ -n "$codename" ]] || fail 'В /etc/os-release отсутствует VERSION_CODENAME.'
  architecture="$(dpkg --print-architecture)"

  printf 'Устанавливаю Docker Engine и Compose plugin из официального apt-репозитория Docker для %s.\n' "$ID"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y ca-certificates curl openssl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$repository_id/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n' \
    "$architecture" "$repository_id" "$codename" > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
}

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  install_docker
fi
command -v openssl >/dev/null 2>&1 || fail 'Не найдена команда openssl; установите пакет openssl.'
command -v curl >/dev/null 2>&1 || fail 'Не найдена команда curl; установите пакет curl.'
if ! docker info >/dev/null 2>&1; then
  if [[ "$EUID" -eq 0 ]] && command -v systemctl >/dev/null 2>&1; then
    systemctl enable --now docker
  fi
  docker info >/dev/null 2>&1 || fail 'Docker Engine не запущен или у пользователя нет доступа. Запустите Docker либо выполните скрипт через sudo.'
fi

printf 'Для загрузки закрытых образов GHCR нужен GitHub Personal Access Token с правом read:packages.\n'
read -r -p 'GitHub username: ' GHCR_USERNAME
[[ -n "$GHCR_USERNAME" ]] || fail 'Не задан GitHub username.'
read -r -s -p 'GitHub token (ввод скрыт): ' GHCR_TOKEN
printf '\n'
[[ -n "$GHCR_TOKEN" ]] || fail 'Не задан GitHub token.'

printf 'Скачиваю конфигурацию развертывания из GitHub.\n'
for config_file in docker-compose.yml Caddyfile; do
  curl -fsSL \
    -H 'Accept: application/vnd.github.raw' \
    -H "Authorization: Bearer $GHCR_TOKEN" \
    "https://api.github.com/repos/$GITHUB_REPOSITORY/contents/$config_file?ref=main" \
    -o "$config_file" ||
    fail "Не удалось скачать $config_file. Проверьте доступ к GitHub-репозиторию."
done

printf '%s' "$GHCR_TOKEN" | docker login ghcr.io --username "$GHCR_USERNAME" --password-stdin ||
  fail 'Не удалось выполнить вход в GHCR. Проверьте username и токен с правом read:packages.'
unset GHCR_TOKEN

GENERATED_ADMIN_PASSWORD=''
if [[ -f .env ]]; then
  printf 'Найден существующий .env. Он не будет перезаписан.\n'
  read -r -p 'Использовать его и перейти к проверке/запуску? [Y/n] ' reuse_env
  [[ -z "$reuse_env" || "$reuse_env" =~ ^[YyДд]$ ]] || fail 'Сохраните существующий .env отдельно, затем повторите запуск.'
  ask SITE_DOMAIN 'Production-домен сайта' "$(env_value SITE_DOMAIN || printf 'chuvashstroy.ru')"
  ask ADMIN_DOMAIN 'Production-домен админки' "$(env_value ADMIN_DOMAIN || printf 'admin.%s' "$SITE_DOMAIN")"
  [[ "$SITE_DOMAIN" =~ ^([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$ ]] || fail 'Некорректный основной домен.'
  [[ "$ADMIN_DOMAIN" =~ ^([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$ ]] || fail 'Некорректный домен админки.'
  [[ "$SITE_DOMAIN" != "$ADMIN_DOMAIN" ]] || fail 'Домен сайта и админки должны различаться.'
  set_env_value SITE_DOMAIN "$SITE_DOMAIN"
  set_env_value ADMIN_DOMAIN "$ADMIN_DOMAIN"
  set_env_value COOKIE_SECURE true
  set_env_value IMAGE_REPOSITORY "ghcr.io/$GITHUB_REPOSITORY"
  remove_env_value TELEGRAM_BOT_TOKEN
  remove_env_value TELEGRAM_CHAT_ID
  remove_env_value TELEGRAM_ALLOWED_USER_IDS
  remove_env_value COMPANY_NAME
  remove_env_value COMPANY_TAGLINE
  remove_env_value COMPANY_CITY
  remove_env_value COMPANY_PHONE
  remove_env_value COMPANY_YEARS
  remove_env_value COMPANY_PROJECTS_COMPLETED
else
  SITE_DOMAIN=''
  ADMIN_DOMAIN=''
  ADMIN_USERNAME=''
  ADMIN_PASSWORD=''
  printf 'Настройка production-развертывания. Секреты не будут показаны повторно.\n'
  ask SITE_DOMAIN 'Основной домен сайта' 'chuvashstroy.ru'
  ask ADMIN_DOMAIN 'Домен админки' "admin.$SITE_DOMAIN"
  [[ "$SITE_DOMAIN" =~ ^([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$ ]] || fail 'Некорректный основной домен.'
  [[ "$ADMIN_DOMAIN" =~ ^([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$ ]] || fail 'Некорректный домен админки.'
  [[ "$SITE_DOMAIN" != "$ADMIN_DOMAIN" ]] || fail 'Домен сайта и админки должны различаться.'

  ask ADMIN_USERNAME 'Логин администратора' 'brigadir'
  [[ "$ADMIN_USERNAME" =~ ^[A-Za-z0-9_-]{3,64}$ ]] || fail 'Логин должен содержать 3–64 символа: латиницу, цифры, _ или -.'
  ask_secret ADMIN_PASSWORD 'Пароль администратора'

  DB_PASSWORD="$(openssl rand -hex 32)"
  JWT_SECRET="$(openssl rand -hex 32)"
  tmp_env="$(mktemp .env.XXXXXX)"
  trap 'rm -f "$tmp_env"' EXIT
  cat > "$tmp_env" <<EOF
POSTGRES_DB=buildcorp
POSTGRES_USER=buildcorp
DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=$JWT_SECRET
ADMIN_USERNAME=$ADMIN_USERNAME
ADMIN_PASSWORD=$ADMIN_PASSWORD
COOKIE_SECURE=true
CLIENT_PORT=3000
ADMIN_PORT=3001
SITE_DOMAIN=$SITE_DOMAIN
ADMIN_DOMAIN=$ADMIN_DOMAIN
IMAGE_REPOSITORY=ghcr.io/$GITHUB_REPOSITORY
EOF
  chmod 600 "$tmp_env"
  mv "$tmp_env" .env
  trap - EXIT
fi

chmod 600 .env
for key in DB_PASSWORD JWT_SECRET ADMIN_USERNAME ADMIN_PASSWORD; do
  value="$(env_value "$key")"
  [[ -n "$value" && "$value" != replace_* ]] || fail "В .env не задано обязательное поле $key. Заполните его и повторите deploy."
done
[[ "$(env_value COOKIE_SECURE)" == true ]] || fail 'Для production требуется COOKIE_SECURE=true.'
[[ -n "$(env_value SITE_DOMAIN)" && -n "$(env_value ADMIN_DOMAIN)" ]] || fail 'В .env не заданы SITE_DOMAIN и ADMIN_DOMAIN.'

docker compose --profile production config --quiet || fail 'Проверка docker-compose завершилась ошибкой; проверьте .env.'
docker compose --profile production pull || fail 'Не удалось скачать образы. Убедитесь, что GitHub Actions уже опубликовал образы в GHCR.'
docker compose --profile production up -d --no-build

printf '\nРазвертывание запущено.\n'
printf 'Сайт:   https://%s\n' "$(sed -n 's/^SITE_DOMAIN=//p' .env | head -n 1)"
printf 'Админка: https://%s\n' "$(sed -n 's/^ADMIN_DOMAIN=//p' .env | head -n 1)"
printf 'Проверка сервисов: docker compose --profile production ps\n'
if [[ -n "$GENERATED_ADMIN_PASSWORD" ]]; then
  printf 'Сгенерированный пароль администратора: %s\n' "$GENERATED_ADMIN_PASSWORD"
  printf 'Сохраните его в менеджере паролей.\n'
fi