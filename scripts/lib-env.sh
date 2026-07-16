load_env_file() {
  ENV_FILE="${1:-.env}"

  if [ ! -f "$ENV_FILE" ]; then
    return 0
  fi

  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ""|\#*) continue ;;
      *=*)
        key="${line%%=*}"
        value="${line#*=}"
        case "$key" in
          *[!A-Za-z0-9_]*|"") continue ;;
          *) export "$key=$value" ;;
        esac
        ;;
    esac
  done < "$ENV_FILE"
}
